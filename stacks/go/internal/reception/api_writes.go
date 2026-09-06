package reception

import (
	"clinicops/internal/apperr"
)

// この節はデータのルート（JSON API）向けの書き込みを持つ。
// 画面（HTML）向けの書き込み（mutations.go）はローカルの `Error` 型で
// 文言だけを返す作りだが、こちらは `apperr.Error` を返し、ステータスコードと
// 契約の固定文言をそのまま呼び出し側（internal/server）へ渡せるようにする。

// ReceptionByID はIDで受付1件を引く。
func (s *Store) ReceptionByID(id int) (Reception, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	r, ok := s.receptions[id]
	if !ok {
		return Reception{}, false
	}
	return *r, true
}

// CreateReception は受付を1件登録する。
// display_no は指定が無ければ、その日・その区分の最大値+1を採る。
func (s *Store) CreateReception(in Reception) (Reception, *apperr.Error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if in.PatientID == 0 {
		return Reception{}, apperr.New(apperr.InvalidInput).WithDetails(
			apperr.Detail{Field: "patient_id", Message: "動物を指定してください。"},
		)
	}
	if _, ok := s.patients[in.PatientID]; !ok {
		return Reception{}, apperr.New(apperr.NotFound)
	}

	r := in
	r.ID = s.nextReceptionID
	s.nextReceptionID++
	if r.ReceivedAt == "" {
		r.ReceivedAt = jstNowString()
	}
	if r.Status == "" {
		r.Status = "waiting"
	}
	if r.DisplayNo == 0 {
		date := receptionDate(r.ReceivedAt)
		kindName := ""
		if r.MedicalPurpose != nil {
			kindName = *r.MedicalPurpose
		}
		max := 0
		for _, ex := range s.receptions {
			if receptionDate(ex.ReceivedAt) != date {
				continue
			}
			exKind := ""
			if ex.MedicalPurpose != nil {
				exKind = *ex.MedicalPurpose
			}
			if exKind != kindName {
				continue
			}
			if ex.DisplayNo > max {
				max = ex.DisplayNo
			}
		}
		r.DisplayNo = max + 1
	}
	s.receptions[r.ID] = &r
	return r, nil
}

// UpdateReception は受付の状態・表示順・担当をまとめて更新する
// （spec/openapi.yaml api_update_reception「上下送り含む」）。
// 0値・空文字は「変更しない」ではなく「そのまま設定する」——JSON PATCHは
// 送られたフィールドをそのまま反映する契約（ReceptionスキーマはPartialではない）。
func (s *Store) UpdateReception(id int, in Reception) (Reception, *apperr.Error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	r, ok := s.receptions[id]
	if !ok {
		return Reception{}, apperr.New(apperr.NotFound)
	}
	if in.DisplayNo != 0 {
		r.DisplayNo = in.DisplayNo
	}
	if in.Status != "" {
		r.Status = in.Status
	}
	if in.StaffID != nil {
		r.StaffID = in.StaffID
	}
	if in.OwnerPurpose != nil {
		r.OwnerPurpose = in.OwnerPurpose
	}
	if in.MedicalPurpose != nil {
		r.MedicalPurpose = in.MedicalPurpose
	}
	return *r, nil
}

// PatchPatient は動物の項目をまとめて更新する（JSON APIのPATCH向け）。
func (s *Store) PatchPatient(karteNo string, in Patient) (Patient, *apperr.Error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.patientsByKarte[karteNo]
	if !ok {
		return Patient{}, apperr.New(apperr.NotFound)
	}
	if in.NameKana != "" {
		p.NameKana = in.NameKana
	}
	if in.NameKanji != "" {
		p.NameKanji = in.NameKanji
	}
	if in.Species != "" {
		p.Species = in.Species
	}
	if in.Breed != "" {
		p.Breed = in.Breed
	}
	if in.Sex != "" {
		p.Sex = in.Sex
	}
	if in.BirthDate != nil {
		p.BirthDate = in.BirthDate
	}
	if in.NeuterDate != nil {
		p.NeuterDate = in.NeuterDate
	}
	s.patients[p.ID] = p
	s.patientsByKarte[karteNo] = p
	return *p, nil
}

// PatchOwner は飼主の項目をまとめて更新する（JSON APIのPATCH向け）。
func (s *Store) PatchOwner(ownerNo string, in Owner) (Owner, *apperr.Error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	o, ok := s.ownersByNo[ownerNo]
	if !ok {
		return Owner{}, apperr.New(apperr.NotFound)
	}
	if in.NameKana != "" {
		o.NameKana = in.NameKana
	}
	if in.NameKanji != "" {
		o.NameKanji = in.NameKanji
	}
	if in.PostalCode != "" {
		o.PostalCode = in.PostalCode
	}
	if in.Address1 != "" {
		o.Address1 = in.Address1
	}
	if in.Address2 != "" {
		o.Address2 = in.Address2
	}
	if in.Phone != "" {
		o.Phone = in.Phone
	}
	if in.Mobile != "" {
		o.Mobile = in.Mobile
	}
	s.owners[o.ID] = o
	s.ownersByNo[ownerNo] = o
	return *o, nil
}
