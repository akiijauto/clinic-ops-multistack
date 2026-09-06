package billing

import (
	"fmt"
	"time"

	"clinicops/internal/apperr"
	"clinicops/internal/config"
)

// この節は会計伝票（Billing/BillingDetail）の読み取りアクセサと書き込みを持つ。
// 保存先（internal/store）が決まるまでのあいだ、プロセス内メモリだけで
// 完結させる（package doc 冒頭のとおり）。エラーは apperr.Error で返し、
// 呼び出し側（画面ルート・JSONルートの両方）がそのまま
// apperr.Write / apperr.Message へ渡せるようにしてある。

// Billing はIDで伝票1件を引く。
func (s *Store) Billing(id int) (Billing, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	b, ok := s.billings[id]
	return b, ok
}

// BillingDetails は伝票の明細を row_no 順で返す。
func (s *Store) BillingDetails(billingID int) []BillingDetail {
	s.mu.RLock()
	defer s.mu.RUnlock()
	src := s.detailsByID[billingID]
	out := make([]BillingDetail, len(src))
	copy(out, src)
	return out
}

// OwnerByID はIDで飼主を引く。
func (s *Store) OwnerByID(id int) (Owner, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	o, ok := s.ownersByID[id]
	return o, ok
}

// OwnerByNo は owner_no で飼主を引く（JSON API `/api/owners/{owner_no}/billings` 向け）。
func (s *Store) OwnerByNo(ownerNo string) (Owner, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, o := range s.ownersByID {
		if o.OwnerNo == ownerNo {
			return o, true
		}
	}
	return Owner{}, false
}

// PatientByID はIDで動物を引く。
func (s *Store) PatientByID(id int) (Patient, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.patientsByID[id]
	return p, ok
}

// PatientByKarteNo はカルテ番号で動物を引く。
func (s *Store) PatientByKarteNo(karteNo string) (Patient, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.patientsByNo[karteNo]
	return p, ok
}

// PriceItems は料金マスタを分類（上位1階層）ごとにまとめて返す
// （会計画面のピッカー用）。分類名・項目名の順で安定させる。
func (s *Store) PriceItems() []PriceItem {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]PriceItem, 0, len(s.priceItems))
	for _, it := range s.priceItems {
		out = append(out, it)
	}
	sortPriceItems(out)
	return out
}

// billingsSortedLocked は id の一覧を billed_on 降順（同日なら id 降順）に並べる。
// 呼び出し側で mu を確保していること。
func (s *Store) billingsSortedLocked(ids []int) []Billing {
	out := make([]Billing, len(ids))
	for i, id := range ids {
		out[i] = s.billings[id]
	}
	sortBillingsDesc(out)
	return out
}

// BillingsForPatient は指定した動物の伝票を新しい順で返す（会計履歴・動物範囲）。
func (s *Store) BillingsForPatient(patientID int) []Billing {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var ids []int
	for _, id := range s.billingOrder {
		if s.billings[id].PatientID == patientID {
			ids = append(ids, id)
		}
	}
	return s.billingsSortedLocked(ids)
}

// BillingsForOwner は指定した飼主に紐づく（複数の動物をまたいだ）伝票を
// 新しい順で返す（会計履歴・飼主範囲。動物範囲の集合を含む）。
func (s *Store) BillingsForOwner(ownerID int) []Billing {
	s.mu.RLock()
	defer s.mu.RUnlock()
	ids := append([]int(nil), s.billingsByOwner[ownerID]...)
	return s.billingsSortedLocked(ids)
}

// AllBillings は病院全体の伝票を新しい順で返す（会計履歴・全体範囲）。
func (s *Store) AllBillings() []Billing {
	s.mu.RLock()
	defer s.mu.RUnlock()
	ids := append([]int(nil), s.billingOrder...)
	return s.billingsSortedLocked(ids)
}

// PendingBillingForPatient は、その動物のいま開くべき伝票を返す。
// draft の伝票がすでにあれば（複数あれば最新）それを返し、無ければ ok=false。
// 会計画面が `slip` 指定なしで開かれたときの既定入口として使う。
func (s *Store) PendingBillingForPatient(patientID int) (Billing, bool) {
	for _, b := range s.BillingsForPatient(patientID) {
		if b.Status == "draft" {
			return b, true
		}
	}
	return Billing{}, false
}

// CreateDraftBilling はその動物の新しい draft 伝票を作る（伝票番号は確定時まで空）。
func (s *Store) CreateDraftBilling(patientID int) (Billing, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	patient, ok := s.patientsByID[patientID]
	if !ok {
		return Billing{}, apperr.New(apperr.NotFound)
	}

	b := Billing{
		ID:        s.nextBillingID,
		PatientID: patientID,
		OwnerID:   patient.OwnerID,
		Status:    "draft",
		BilledOn:  today(),
	}
	s.nextBillingID++
	s.billings[b.ID] = b
	s.billingOrder = append(s.billingOrder, b.ID)
	s.billingsByOwner[b.OwnerID] = append(s.billingsByOwner[b.OwnerID], b.ID)
	return b, nil
}

// AddDetail は draft の伝票へ、料金マスタの1項目を明細行として追加する。
// 単価・課税区分・名称はその時点の料金マスタから写す（あとで料金マスタが
// 変わっても、すでに追加した明細の額は変わらない — 伝票は発行時点のスナップショット）。
// unit_price が料金マスタ側で未設定（null）の項目は、null のまま追加する
// （0円に読み替えない。合計計算側（BillingAmounts）が除外して数える）。
func (s *Store) AddDetail(billingID int, priceCode string, quantity float64) (BillingDetail, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	b, ok := s.billings[billingID]
	if !ok {
		return BillingDetail{}, apperr.New(apperr.NotFound)
	}
	if b.Status != "draft" {
		return BillingDetail{}, apperr.New(apperr.InvalidInput).WithDetails(
			apperr.Detail{Field: "billing_id", Message: "確定済みの伝票には明細を追加できません。"},
		)
	}
	item, ok := s.priceItems[priceCode]
	if !ok {
		return BillingDetail{}, apperr.New(apperr.InvalidInput).WithDetails(
			apperr.Detail{Field: "price_code", Message: "存在しない料金項目です。"},
		)
	}
	if quantity <= 0 {
		return BillingDetail{}, apperr.New(apperr.InvalidInput).WithDetails(
			apperr.Detail{Field: "quantity", Message: "数量は0より大きい値にしてください。"},
		)
	}

	rows := s.detailsByID[billingID]
	d := BillingDetail{
		ID:        s.nextDetailID,
		BillingID: billingID,
		RowNo:     len(rows) + 1,
		PriceCode: priceCode,
		Name:      item.Name,
		Quantity:  quantity,
		UnitPrice: item.UnitPrice,
		IsTaxable: item.IsTaxable,
	}
	s.nextDetailID++
	s.detailsByID[billingID] = append(rows, d)
	return d, nil
}

// DuplicateDetail は既存の明細行を複写する（draft の伝票にだけ行える）。
func (s *Store) DuplicateDetail(billingID, detailID int) (BillingDetail, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	b, ok := s.billings[billingID]
	if !ok {
		return BillingDetail{}, apperr.New(apperr.NotFound)
	}
	if b.Status != "draft" {
		return BillingDetail{}, apperr.New(apperr.InvalidInput).WithDetails(
			apperr.Detail{Field: "billing_id", Message: "確定済みの伝票の明細は複写できません。"},
		)
	}
	rows := s.detailsByID[billingID]
	idx := indexOfDetail(rows, detailID)
	if idx < 0 {
		return BillingDetail{}, apperr.New(apperr.NotFound)
	}
	copyOf := rows[idx]
	copyOf.ID = s.nextDetailID
	copyOf.RowNo = len(rows) + 1
	s.nextDetailID++
	s.detailsByID[billingID] = append(rows, copyOf)
	return copyOf, nil
}

// RemoveDetail は明細1行を取り消す（draft の伝票にだけ行える）。
func (s *Store) RemoveDetail(billingID, detailID int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	b, ok := s.billings[billingID]
	if !ok {
		return apperr.New(apperr.NotFound)
	}
	if b.Status != "draft" {
		return apperr.New(apperr.InvalidInput).WithDetails(
			apperr.Detail{Field: "billing_id", Message: "確定済みの伝票の明細は削除できません。"},
		)
	}
	rows := s.detailsByID[billingID]
	idx := indexOfDetail(rows, detailID)
	if idx < 0 {
		return apperr.New(apperr.NotFound)
	}
	s.detailsByID[billingID] = append(rows[:idx], rows[idx+1:]...)
	return nil
}

// ClearDetails は draft の伝票の明細をすべて取り消す（全削除）。
func (s *Store) ClearDetails(billingID int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	b, ok := s.billings[billingID]
	if !ok {
		return apperr.New(apperr.NotFound)
	}
	if b.Status != "draft" {
		return apperr.New(apperr.InvalidInput).WithDetails(
			apperr.Detail{Field: "billing_id", Message: "確定済みの伝票の明細は削除できません。"},
		)
	}
	delete(s.detailsByID, billingID)
	return nil
}

// ConfirmBilling は伝票を確定する（status を confirmed にし、伝票番号を採番する）。
// 明細が1行も無い伝票は確定できない。
func (s *Store) ConfirmBilling(billingID int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	b, ok := s.billings[billingID]
	if !ok {
		return apperr.New(apperr.NotFound)
	}
	if b.Status == "confirmed" {
		return nil // 既に確定済み。二重確定はエラーにしない（冪等に扱う）
	}
	if len(s.detailsByID[billingID]) == 0 {
		return apperr.New(apperr.InvalidInput).WithDetails(
			apperr.Detail{Field: "details", Message: "明細が1行も無い伝票は確定できません。"},
		)
	}
	b.Status = "confirmed"
	b.SlipNo = s.nextSlipNoLocked(b.BilledOn)
	s.billings[billingID] = b
	return nil
}

// RecordPayment は支払いの記録（受領額・方法・レジ担当）を伝票に付ける。
func (s *Store) RecordPayment(billingID int, paidAmount *int, method *string, cashierStaffID *int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	b, ok := s.billings[billingID]
	if !ok {
		return apperr.New(apperr.NotFound)
	}
	b.PaidAmount = paidAmount
	b.PaymentMethod = method
	b.CashierStaffID = cashierStaffID
	s.billings[billingID] = b
	return nil
}

// nextSlipNoLocked は `B-YYYYMMDD-NNNN` 形式で採番する（`data/seed.json` の
// 既存の伝票番号と同じ書式）。NNNN はその日に確定した伝票の通し番号。
// 呼び出し側で mu を確保していること。
func (s *Store) nextSlipNoLocked(billedOn string) string {
	day := ""
	for _, c := range billedOn {
		if c != '-' {
			day += string(c)
		}
	}
	seq := 1
	for _, id := range s.billingOrder {
		b := s.billings[id]
		if b.BilledOn == billedOn && b.Status == "confirmed" && b.SlipNo != "" {
			seq++
		}
	}
	return fmt.Sprintf("B-%s-%04d", day, seq)
}

func indexOfDetail(rows []BillingDetail, id int) int {
	for i, d := range rows {
		if d.ID == id {
			return i
		}
	}
	return -1
}

func today() string {
	return time.Now().In(config.JST).Format("2006-01-02")
}
