package reception

import (
	"fmt"
	"sort"
	"strconv"
	"time"

	"clinicops/internal/config"
)

// NewOwnerAndPatientInput は「新規登録」画面（画面2）の入力。
type NewOwnerAndPatientInput struct {
	// ExistingOwnerNo が空でなければ、その飼主に動物を1頭追加するだけになる
	// （spec/screens.md「既存の飼主に2頭目以降を足す入口も兼ねる」）。
	ExistingOwnerNo string

	OwnerNameKana  string
	OwnerNameKanji string
	OwnerPostal    string
	OwnerAddress1  string
	OwnerAddress2  string
	OwnerPhone     string
	OwnerMobile    string

	PatientNameKana  string
	PatientNameKanji string
	Species          string
	Breed            string
	Sex              string
	BirthDate        string
	NeuterDate       string
}

// NextKarteNo は保存前から見える「次に割り当てられる karte_no」
// （spec/screens.md 画面2「表示するもの」）。
func (s *Store) NextKarteNo() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return strconv.Itoa(s.nextPatientSeq)
}

// CreateOwnerAndPatient は飼主（新規時のみ）と動物を1回の操作で作る。
//
// 満たすべきこと（spec/screens.md 画面2）:
//   - 飼主だけが存在して Patient が無い状態を作れない（動物欄が空なら保存は成立しない）
//   - 発行される karte_no は既存のどれとも重複しない
func (s *Store) CreateOwnerAndPatient(in NewOwnerAndPatientInput) (Patient, *Error) {
	if trimEmpty(in.PatientNameKanji) && trimEmpty(in.PatientNameKana) {
		return Patient{}, &Error{Field: "patient_name_kanji", Message: "動物の氏名は必須です。"}
	}
	if in.Sex != "male" && in.Sex != "female" && in.Sex != "unknown" {
		return Patient{}, &Error{Field: "sex", Message: "性別の指定が正しくありません。"}
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	var owner *Owner
	if in.ExistingOwnerNo != "" {
		o, ok := s.ownersByNo[in.ExistingOwnerNo]
		if !ok {
			return Patient{}, &Error{Field: "owner", Message: "指定された飼主が見つかりません。"}
		}
		owner = o
	} else {
		if trimEmpty(in.OwnerNameKanji) {
			return Patient{}, &Error{Field: "owner_name_kanji", Message: "飼主の氏名は必須です。"}
		}
		ownerNo := fmt.Sprintf("O-%05d", s.nextOwnerSeq)
		s.nextOwnerSeq++
		newOwner := Owner{
			ID:         nextID(s.owners),
			OwnerNo:    ownerNo,
			NameKana:   in.OwnerNameKana,
			NameKanji:  in.OwnerNameKanji,
			PostalCode: in.OwnerPostal,
			Address1:   in.OwnerAddress1,
			Address2:   in.OwnerAddress2,
			Phone:      in.OwnerPhone,
			Mobile:     in.OwnerMobile,
		}
		s.owners[newOwner.ID] = &newOwner
		s.ownersByNo[newOwner.OwnerNo] = &newOwner
		owner = &newOwner
	}

	karteNo := strconv.Itoa(s.nextPatientSeq)
	s.nextPatientSeq++
	p := Patient{
		ID:        nextID(s.patients),
		KarteNo:   karteNo,
		OwnerID:   owner.ID,
		NameKana:  in.PatientNameKana,
		NameKanji: in.PatientNameKanji,
		Species:   in.Species,
		Breed:     in.Breed,
		Sex:       in.Sex,
	}
	if in.BirthDate != "" {
		bd := in.BirthDate
		p.BirthDate = &bd
	}
	if in.NeuterDate != "" {
		nd := in.NeuterDate
		p.NeuterDate = &nd
	}
	s.patients[p.ID] = &p
	s.patientsByKarte[p.KarteNo] = &p
	return p, nil
}

func nextID[T any](m map[int]T) int {
	maxID := 0
	for id := range m {
		if id > maxID {
			maxID = id
		}
	}
	return maxID + 1
}

func trimEmpty(s string) bool {
	for _, r := range s {
		if r != ' ' && r != '\t' && r != '\n' {
			return false
		}
	}
	return true
}

// Error はこのパッケージ内の入力検証エラー（フィールド単位）。
// apperr.Detail と同じ形にしてある（JSON応答を組み立てるとき変換するだけで済む）。
type Error struct {
	Field   string
	Message string
}

// DeletePatient は Patient.deleted_at に日時を入れる（物理削除しない）。
// この動物がその飼主の最後の1頭なら Owner.deleted_at にも日時を入れる
// （spec/openapi.yaml screen_delete_animal の説明）。
// 既に削除済みなら何もしない（冪等）。
func (s *Store) DeletePatient(karteNo string) (Patient, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.patientsByKarte[karteNo]
	if !ok {
		return Patient{}, false
	}
	if p.DeletedAt == nil {
		now := jstNowString()
		p.DeletedAt = &now
	}
	if s.ownerHasNoRemainingPatientLocked(p.OwnerID) {
		if o, ok := s.owners[p.OwnerID]; ok && o.DeletedAt == nil {
			now := jstNowString()
			o.DeletedAt = &now
		}
	}
	return *p, true
}

func (s *Store) ownerHasNoRemainingPatientLocked(ownerID int) bool {
	for _, p := range s.patients {
		if p.OwnerID == ownerID && p.DeletedAt == nil {
			return false
		}
	}
	return true
}

// RestorePatient は Patient.deleted_at を消す（論理削除の取り消し）。
func (s *Store) RestorePatient(karteNo string) (Patient, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.patientsByKarte[karteNo]
	if !ok {
		return Patient{}, false
	}
	p.DeletedAt = nil
	return *p, true
}

// DeleteOwner は Owner.deleted_at に日時を入れる。紐づく Patient は消えない。
func (s *Store) DeleteOwner(ownerNo string) (Owner, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	o, ok := s.ownersByNo[ownerNo]
	if !ok {
		return Owner{}, false
	}
	if o.DeletedAt == nil {
		now := jstNowString()
		o.DeletedAt = &now
	}
	return *o, true
}

// RestoreOwner は Owner.deleted_at を消す。
func (s *Store) RestoreOwner(ownerNo string) (Owner, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	o, ok := s.ownersByNo[ownerNo]
	if !ok {
		return Owner{}, false
	}
	o.DeletedAt = nil
	return *o, true
}

// RenumberPatient は karte_no を未使用の値にだけ付け替える
// （spec/screens.md 画面3「番号変更」）。既に使われている番号への変更は拒否する。
func (s *Store) RenumberPatient(oldKarteNo, newKarteNo string) (Patient, *Error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.patientsByKarte[oldKarteNo]
	if !ok {
		return Patient{}, &Error{Field: "karte_no", Message: "指定された動物が見つかりません。"}
	}
	if newKarteNo == oldKarteNo {
		return *p, nil
	}
	if _, used := s.patientsByKarte[newKarteNo]; used {
		return Patient{}, &Error{Field: "karte_no", Message: "その番号は既に使われています。"}
	}
	delete(s.patientsByKarte, oldKarteNo)
	p.KarteNo = newKarteNo
	s.patientsByKarte[newKarteNo] = p
	return *p, nil
}

// RenumberOwner は owner_no を未使用の値にだけ付け替える。
func (s *Store) RenumberOwner(oldOwnerNo, newOwnerNo string) (Owner, *Error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	o, ok := s.ownersByNo[oldOwnerNo]
	if !ok {
		return Owner{}, &Error{Field: "owner_no", Message: "指定された飼主が見つかりません。"}
	}
	if newOwnerNo == oldOwnerNo {
		return *o, nil
	}
	if _, used := s.ownersByNo[newOwnerNo]; used {
		return Owner{}, &Error{Field: "owner_no", Message: "その番号は既に使われています。"}
	}
	delete(s.ownersByNo, oldOwnerNo)
	o.OwnerNo = newOwnerNo
	s.ownersByNo[newOwnerNo] = o
	return *o, nil
}

// UpdatePatientFields は顧客画面「保存」の動物側の更新。
func (s *Store) UpdatePatientFields(karteNo string, nameKana, nameKanji, species, breed, sex, birthDate, neuterDate string) (Patient, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.patientsByKarte[karteNo]
	if !ok {
		return Patient{}, false
	}
	p.NameKana, p.NameKanji, p.Species, p.Breed, p.Sex = nameKana, nameKanji, species, breed, sex
	if birthDate != "" {
		p.BirthDate = &birthDate
	} else {
		p.BirthDate = nil
	}
	if neuterDate != "" {
		p.NeuterDate = &neuterDate
	} else {
		p.NeuterDate = nil
	}
	return *p, true
}

// UpdateOwnerFields は顧客画面「保存」の飼主側の更新。
func (s *Store) UpdateOwnerFields(ownerNo string, nameKana, nameKanji, postal, addr1, addr2, phone, mobile string) (Owner, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	o, ok := s.ownersByNo[ownerNo]
	if !ok {
		return Owner{}, false
	}
	o.NameKana, o.NameKanji = nameKana, nameKanji
	o.PostalCode, o.Address1, o.Address2 = postal, addr1, addr2
	o.Phone, o.Mobile = phone, mobile
	return *o, true
}

// MoveReception は選択した受付の display_no を、隣接する受付（同じ日・同じ
// 受付区分の絞り込み内で隣り合う行）と入れ替える。他の行の順序は変わらない
// （spec/screens.md 画面1「満たすべきこと」）。
func (s *Store) MoveReception(id int, direction string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	target, ok := s.receptions[id]
	if !ok {
		return false
	}
	date := receptionDate(target.ReceivedAt)
	var kindName string
	if target.MedicalPurpose != nil {
		kindName = *target.MedicalPurpose
	}

	var siblings []*Reception
	for _, r := range s.receptions {
		if receptionDate(r.ReceivedAt) != date {
			continue
		}
		rk := ""
		if r.MedicalPurpose != nil {
			rk = *r.MedicalPurpose
		}
		if rk != kindName {
			continue
		}
		siblings = append(siblings, r)
	}
	sortReceptionsForDisplay(siblings)

	idx := -1
	for i, r := range siblings {
		if r.ID == id {
			idx = i
			break
		}
	}
	if idx < 0 {
		return false
	}
	var otherIdx int
	switch direction {
	case "up":
		otherIdx = idx - 1
	case "down":
		otherIdx = idx + 1
	default:
		return false
	}
	if otherIdx < 0 || otherIdx >= len(siblings) {
		return false
	}
	siblings[idx].DisplayNo, siblings[otherIdx].DisplayNo = siblings[otherIdx].DisplayNo, siblings[idx].DisplayNo
	return true
}

func sortReceptionsForDisplay(rs []*Reception) {
	sort.Slice(rs, func(i, j int) bool {
		di, dj := rs[i].Status == "done", rs[j].Status == "done"
		if di != dj {
			return !di
		}
		return rs[i].DisplayNo < rs[j].DisplayNo
	})
}

func jstNowString() string {
	return nowJST().In(config.JST).Format(time.RFC3339)
}
