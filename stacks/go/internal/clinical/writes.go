package clinical

import (
	"sort"
	"strings"
	"time"

	"clinicops/internal/apperr"
	"clinicops/internal/config"
)

// todayJST は今日の日付（JST）を `YYYY-MM-DD` で返す。
func todayJST() string {
	return time.Now().In(config.JST).Format("2006-01-02")
}

// nowJST は現在時刻（JST）を秒精度のRFC3339で返す。deleted_at 等に使う。
func nowJST() string {
	return time.Now().In(config.JST).Format(time.RFC3339)
}

// ---- 予防・投薬の種別マスタ ----

// PreventionKinds は予防・投薬の種別マスタを配列順で返す
// （`data/masters.json` の `prevention_kinds`。投薬と予防はこの種別を共通で使う）。
func (s *Store) PreventionKinds() []PreventionKind {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]PreventionKind(nil), s.preventionKinds...)
}

// PreventionKindByID はマスタの行id（配列順の1始まり）で種別を引く。
func (s *Store) PreventionKindByID(id int) (PreventionKind, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	k, ok := s.preventionKindByID[id]
	return k, ok
}

// ---- カルテ（Visit / ProgressNote）の書き込み ----

// NextVisitNo は指定した患者の次の診察番号（保存前から見せる用）を返す。
func (s *Store) NextVisitNo(patientID int) int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	max := 0
	for _, v := range s.visitsByPatientID[patientID] {
		if v.VisitNo > max {
			max = v.VisitNo
		}
	}
	return max + 1
}

// PreviousVisit はその患者の直前の診察（削除済みを除く、最新1件）を返す。
// 「前回コピー」の元データ、および同ボタンを灰色にするかどうかの判定に使う
// （spec/openapi.yaml「直前の診察が無いときだけ灰色でよい」）。
func (s *Store) PreviousVisit(patientID int) (Visit, bool) {
	vs := s.Visits(patientID, false)
	if len(vs) == 0 {
		return Visit{}, false
	}
	return vs[0], true // Visits は新しい順
}

// SaveVisit はカルテ画面の保存を受け持つ。visitID が 0 のときは新規作成、
// それ以外は既存の Visit（その patientID に属し、削除されていないもの）を更新する。
// notes は行ごと丸ごと置き換える（既存行の値を混在させない —
// spec/model.md 7章「全患者に同じ体温が印字される」不具合の再発防止）。
func (s *Store) SaveVisit(patientID int, visitID int, in Visit, notes []ProgressNote) (Visit, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var v Visit
	if visitID != 0 {
		existing, ok := s.visitsByID[visitID]
		if !ok || existing.PatientID != patientID || existing.DeletedAt != nil {
			return Visit{}, apperr.New(apperr.NotFound)
		}
		v = existing
	} else {
		max := 0
		for _, e := range s.visitsByPatientID[patientID] {
			if e.VisitNo > max {
				max = e.VisitNo
			}
		}
		v = Visit{ID: s.nextVisitID, PatientID: patientID, VisitNo: max + 1}
		s.nextVisitID++
	}

	v.VisitDate = in.VisitDate
	if v.VisitDate == "" {
		v.VisitDate = todayJST()
	}
	v.VisitTime = in.VisitTime
	v.BodyWeightKg = in.BodyWeightKg
	v.ChiefComplaint = in.ChiefComplaint
	v.Symptom = in.Symptom
	v.Diagnosis = in.Diagnosis
	v.Treatment = in.Treatment
	v.StaffID = in.StaffID

	s.visitsByID[v.ID] = v
	s.replaceVisitInPatientList(v)

	newNotes := make([]ProgressNote, 0, len(notes))
	for i, n := range notes {
		n.ID = s.nextProgressNoteID
		s.nextProgressNoteID++
		n.VisitID = v.ID
		n.RowNo = i + 1
		newNotes = append(newNotes, n)
	}
	s.notesByVisitID[v.ID] = newNotes

	return v, nil
}

// replaceVisitInPatientList は visitsByPatientID の該当行を差し替え、
// 新しい順（VisitDate desc, VisitNo desc）を保つ。
func (s *Store) replaceVisitInPatientList(v Visit) {
	list := s.visitsByPatientID[v.PatientID]
	found := false
	for i, e := range list {
		if e.ID == v.ID {
			list[i] = v
			found = true
			break
		}
	}
	if !found {
		list = append(list, v)
	}
	sort.Slice(list, func(i, j int) bool {
		if list[i].VisitDate != list[j].VisitDate {
			return list[i].VisitDate > list[j].VisitDate
		}
		return list[i].VisitNo > list[j].VisitNo
	})
	s.visitsByPatientID[v.PatientID] = list
}

// DeleteVisit は Visit を論理削除する（`deleted_at` に日時を入れるだけ。
// 行・経過記録は物理的に残す — spec/model.md「消さずに印を付ける」）。
func (s *Store) DeleteVisit(visitID int) (Visit, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	v, ok := s.visitsByID[visitID]
	if !ok {
		return Visit{}, apperr.New(apperr.NotFound)
	}
	now := nowJST()
	v.DeletedAt = &now
	s.visitsByID[v.ID] = v
	s.replaceVisitInPatientList(v)
	return v, nil
}

// RestoreVisit は論理削除を取り消す（`deleted_at` を消す）。
func (s *Store) RestoreVisit(visitID int) (Visit, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	v, ok := s.visitsByID[visitID]
	if !ok {
		return Visit{}, apperr.New(apperr.NotFound)
	}
	v.DeletedAt = nil
	s.visitsByID[v.ID] = v
	s.replaceVisitInPatientList(v)
	return v, nil
}

// ---- 検査（LabTest / LabTestItem）の書き込み ----

// ListLabTests は指定した患者の検査を新しい順で返す。
func (s *Store) ListLabTests(patientID int) []LabTest {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]LabTest, 0)
	for _, t := range s.labTestsByID {
		if t.PatientID == patientID {
			out = append(out, t)
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].TestedOn != out[j].TestedOn {
			return out[i].TestedOn > out[j].TestedOn
		}
		return out[i].ID > out[j].ID
	})
	return out
}

// CreateLabTest は検査結果を保存する。基準値・判定は保存しない
// （毎回 data/lab_items.json から計算する — Evaluate を使う。spec/model.md 11章）。
func (s *Store) CreateLabTest(patientID int, in LabTest, items []LabTestItem) (LabTest, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	t := LabTest{
		ID:           s.nextLabTestID,
		PatientID:    patientID,
		VisitID:      in.VisitID,
		Category:     in.Category,
		TestedOn:     in.TestedOn,
		TestedAtTime: in.TestedAtTime,
		StaffID:      in.StaffID,
	}
	if t.TestedOn == "" {
		t.TestedOn = todayJST()
	}
	s.nextLabTestID++
	s.labTestsByID[t.ID] = t

	saved := make([]LabTestItem, 0, len(items))
	for _, it := range items {
		it.ID = s.nextLabTestItemID
		s.nextLabTestItemID++
		it.LabTestID = t.ID
		saved = append(saved, it)
	}
	s.labItemsByLabTest[t.ID] = saved

	return t, nil
}

// ---- 投薬（Dosing） ----

// Dosings は指定した患者・種別の年度行を年度の新しい順で返す。
func (s *Store) Dosings(patientID int, kind string) []Dosing {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]Dosing, 0)
	for _, d := range s.dosings {
		if d.PatientID == patientID && d.Kind == kind {
			out = append(out, d)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].FiscalYear > out[j].FiscalYear })
	return out
}

// SaveDosing は年度行の月チェックを保存する。存在しない年度なら新規に行を足す。
// 送られなかった月キーと、空文字で送られた月（チェックを外した月）を区別するため、
// 呼び出し側は m01〜m12 の12個すべてを渡すこと（未チェックは空文字 ""）。
// fiscalYear が 0（未入力）のときは何もしない（新しい行を増やさない）。
func (s *Store) SaveDosing(patientID int, kind string, fiscalYear int, months [12]string) (Dosing, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if fiscalYear == 0 {
		return Dosing{}, apperr.New(apperr.InvalidInput)
	}
	for i, d := range s.dosings {
		if d.PatientID == patientID && d.Kind == kind && d.FiscalYear == fiscalYear {
			d.M01, d.M02, d.M03, d.M04 = months[0], months[1], months[2], months[3]
			d.M05, d.M06, d.M07, d.M08 = months[4], months[5], months[6], months[7]
			d.M09, d.M10, d.M11, d.M12 = months[8], months[9], months[10], months[11]
			s.dosings[i] = d
			return d, nil
		}
	}
	d := Dosing{
		ID: s.nextDosingID, PatientID: patientID, Kind: kind, FiscalYear: fiscalYear,
		M01: months[0], M02: months[1], M03: months[2], M04: months[3],
		M05: months[4], M06: months[5], M07: months[6], M08: months[7],
		M09: months[8], M10: months[9], M11: months[10], M12: months[11],
	}
	s.nextDosingID++
	s.dosings = append(s.dosings, d)
	return d, nil
}

// ---- 予防（Prevention） ----

// Preventions は指定した患者・種別の実施記録を実施日の新しい順で返す。
func (s *Store) Preventions(patientID int, kind string) []Prevention {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]Prevention, 0)
	for _, p := range s.preventions {
		if p.PatientID == patientID && p.Kind == kind {
			out = append(out, p)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].PerformedDate > out[j].PerformedDate })
	return out
}

// CreatePrevention は予防の実施記録を1件追加する。
//
// 次回予定日を空で送った場合、その種別の基本周期が `data/masters.json` に
// 設定されていれば自動計算するはずだが、現在のマスタは種別の基本周期を
// 持たない（コード・名称のみ）。そのため、この実装では**常に**
// 「周期未設定」の扱いとなり、次回予定日は空で保存される
// （spec/screens.md 12章の満たすべきことに沿った、周期データが無い場合の
// 正しい振る舞い。周期を持たせる決定が入ったら、ここに計算を足す）。
func (s *Store) CreatePrevention(patientID int, in Prevention) (Prevention, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p := Prevention{
		ID:            s.nextPreventionID,
		PatientID:     patientID,
		Kind:          in.Kind,
		Content:       in.Content,
		PerformedDate: in.PerformedDate,
		NextDueDate:   in.NextDueDate,
	}
	if p.PerformedDate == "" {
		p.PerformedDate = todayJST()
	}
	s.nextPreventionID++
	s.preventions = append(s.preventions, p)
	return p, nil
}

// ---- 書類（Paper） ----
//
// model.md は紙カルテPDFの取込（KartePdf）を「落としたもの」としているため、
// ここでは実ファイルを保持しない軽量な文書メモとして扱う（openapi.yaml の
// Paper スキーマ＝ id/patient_id/title/note/created_at のみ）。
// 「元から無い」印は Paper 行ではなく患者単位のフラグとして持つ
// （spec/screens.md 13章の操作。openapi.yaml のスキーマには対応する列が無い
// ため、この実装だけが持つ内部状態であることを明記する）。

// Papers は指定した患者の書類を新しい順（作成日時の降順）で返す。
// 取り消し済み（deleted_at あり）は含めない（行自体は保持する）。
func (s *Store) Papers(patientID int) []Paper {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]Paper, 0)
	for _, p := range s.papers {
		if p.PatientID == patientID && p.DeletedAt == nil {
			out = append(out, p)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt > out[j].CreatedAt })
	return out
}

// Paper はIDで書類1件を引く（取り消し済みも引ける。詳細画面用）。
func (s *Store) Paper(id int) (Paper, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, p := range s.papers {
		if p.ID == id {
			return p, true
		}
	}
	return Paper{}, false
}

// IsPDFTitle は取り込み対象のファイル名が `.pdf` かどうかを見る
// （spec/screens.md「PDF以外の形式のファイルは取り込みを拒否する」）。
// 大文字小文字は区別しない。
func IsPDFTitle(title string) bool {
	return strings.HasSuffix(strings.ToLower(title), ".pdf")
}

// CreatePaper は書類を1件取り込む。title が `.pdf` で終わらない場合は拒否する。
func (s *Store) CreatePaper(patientID int, title string, note *string) (Paper, error) {
	if !IsPDFTitle(title) {
		return Paper{}, apperr.New(apperr.InvalidInput)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	p := Paper{
		ID:        s.nextPaperID,
		PatientID: patientID,
		Title:     title,
		Note:      note,
		CreatedAt: nowJST(),
	}
	s.nextPaperID++
	s.papers = append(s.papers, p)
	return p, nil
}

// RemovePaper は書類を取り消す（物理削除しない。行は残す）。
func (s *Store) RemovePaper(paperID int) (Paper, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, p := range s.papers {
		if p.ID == paperID {
			now := nowJST()
			p.DeletedAt = &now
			s.papers[i] = p
			return p, nil
		}
	}
	return Paper{}, apperr.New(apperr.NotFound)
}

// SetNoPaper は「この子の紙カルテは元から無い」の印を付ける・外す。
func (s *Store) SetNoPaper(patientID int, v bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if v {
		s.noPaperPatients[patientID] = true
	} else {
		delete(s.noPaperPatients, patientID)
	}
}

// IsNoPaper は「元から無い」印が付いているかを返す。
func (s *Store) IsNoPaper(patientID int) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.noPaperPatients[patientID]
}
