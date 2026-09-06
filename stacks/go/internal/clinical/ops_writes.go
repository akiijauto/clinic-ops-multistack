package clinical

import (
	"sort"
	"time"

	"clinicops/internal/apperr"
)

// この節は「予約」「入院」の書き込みを持つ（領域4）。
// 半開区間での重複判定は spec/screens.md 19章・coordination/qa/rulings.md
// （終了時刻＝次の開始時刻は重ならない扱い）に従う。

// overlaps は2つの時間帯が半開区間 [start, end) として重なるかどうかを見る。
// 文字列のまま比較する（ISO8601, +09:00 のオフセットが揃っている前提。
// spec/openapi.yaml「すべてJSTで扱う」）——数値比較より単純で、
// タイムゾーン変換のミスを持ち込まない。
func overlaps(aStart, aEnd, bStart, bEnd string) bool {
	return aStart < bEnd && bStart < aEnd
}

// validateReservationLocked はキャンセルされていない予約どうしの重複と、
// 時刻の前後関係を確かめる。excludeID は自分自身（変更時）を除くためのID（0なら除かない）。
// mu は呼び出し側がすでにロックしている前提。
func (s *Store) validateReservationLocked(excludeID int, startsAt, endsAt string, staffID *int, room string) error {
	if !(startsAt < endsAt) {
		return apperr.New(apperr.InvalidInput).WithDetails(
			apperr.Detail{Field: "ends_at", Message: "終了時刻は開始時刻より後にしてください。"},
		)
	}
	for _, r := range s.reservations {
		if r.ID == excludeID || r.Status != "booked" {
			continue
		}
		if !overlaps(startsAt, endsAt, r.StartsAt, r.EndsAt) {
			continue
		}
		if staffID != nil && r.StaffID != nil && *r.StaffID == *staffID {
			return apperr.New(apperr.ReservationConflict)
		}
		if r.Room == room {
			return apperr.New(apperr.ReservationConflict)
		}
	}
	return nil
}

// CreateReservation は予約を新規作成する。
func (s *Store) CreateReservation(in Reservation) (Reservation, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.validateReservationLocked(0, in.StartsAt, in.EndsAt, in.StaffID, in.Room); err != nil {
		return Reservation{}, err
	}

	r := in
	r.ID = s.nextReservationID
	s.nextReservationID++
	r.Status = "booked"
	s.reservations = append(s.reservations, r)
	return r, nil
}

// UpdateReservation は予約の内容を変更する（重複判定は自分自身を除く）。
func (s *Store) UpdateReservation(id int, in Reservation) (Reservation, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	idx := -1
	for i, r := range s.reservations {
		if r.ID == id {
			idx = i
			break
		}
	}
	if idx < 0 {
		return Reservation{}, apperr.New(apperr.NotFound)
	}
	if err := s.validateReservationLocked(id, in.StartsAt, in.EndsAt, in.StaffID, in.Room); err != nil {
		return Reservation{}, err
	}
	r := s.reservations[idx]
	r.StartsAt, r.EndsAt, r.Room = in.StartsAt, in.EndsAt, in.Room
	r.StaffID = in.StaffID
	r.Purpose, r.Note = in.Purpose, in.Note
	if in.PatientID != 0 {
		r.PatientID = in.PatientID
	}
	s.reservations[idx] = r
	return r, nil
}

// CancelReservation は予約を取消にする（行は残す。物理削除しない）。
func (s *Store) CancelReservation(id int) (Reservation, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, r := range s.reservations {
		if r.ID == id {
			r.Status = "cancelled"
			s.reservations[i] = r
			return r, nil
		}
	}
	return Reservation{}, apperr.New(apperr.NotFound)
}

// ReservationByID はIDで予約1件を引く。
func (s *Store) ReservationByID(id int) (Reservation, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, r := range s.reservations {
		if r.ID == id {
			return r, true
		}
	}
	return Reservation{}, false
}

// ---- 入院 ----

// HospitalizationsForPatient は患者の入院記録を新しい順で返す。
func (s *Store) HospitalizationsForPatient(patientID int) []Hospitalization {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var out []Hospitalization
	for _, h := range s.hospByID {
		if h.PatientID == patientID {
			out = append(out, h)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].AdmittedOn > out[j].AdmittedOn })
	return out
}

// HospitalizationsOnDate は指定日（JSTの暦日）に在室している（退院日が
// 未定、または退院日がその日以降の）入院を返す。
func (s *Store) HospitalizationsOnDate(date string) []Hospitalization {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var out []Hospitalization
	for _, h := range s.hospByID {
		if h.AdmittedOn > date {
			continue
		}
		if h.DischargedOn != nil && *h.DischargedOn < date {
			continue
		}
		out = append(out, h)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].AdmittedOn < out[j].AdmittedOn })
	return out
}

// CreateHospitalization は入院を開始する。
func (s *Store) CreateHospitalization(patientID int, admittedOn, room string) (Hospitalization, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if admittedOn == "" {
		admittedOn = time.Now().In(jstLoc).Format("2006-01-02")
	}
	h := Hospitalization{ID: nextHospID(s), PatientID: patientID, AdmittedOn: admittedOn, Room: room}
	s.hospByID[h.ID] = h
	return h, nil
}

func nextHospID(s *Store) int {
	max := 0
	for id := range s.hospByID {
		if id > max {
			max = id
		}
	}
	return max + 1
}

// DischargeHospitalization は退院日を入れて入院を終える。
func (s *Store) DischargeHospitalization(id int, dischargedOn string) (Hospitalization, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	h, ok := s.hospByID[id]
	if !ok {
		return Hospitalization{}, apperr.New(apperr.NotFound)
	}
	if dischargedOn == "" {
		dischargedOn = time.Now().In(jstLoc).Format("2006-01-02")
	}
	h.DischargedOn = &dischargedOn
	s.hospByID[id] = h
	return h, nil
}

// AddCareRecord はケア記録を1行追加する。
// 実施者が空、または退院済みの入院には追加できない
// （spec/screens.md 18章「満たすべきこと」）。
func (s *Store) AddCareRecord(hospID int, in CareRecord) (CareRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	h, ok := s.hospByID[hospID]
	if !ok {
		return CareRecord{}, apperr.New(apperr.NotFound)
	}
	if h.DischargedOn != nil {
		return CareRecord{}, apperr.New(apperr.InvalidInput).WithDetails(
			apperr.Detail{Field: "hospitalization_id", Message: "退院済みの入院には記録を追加できません。"},
		)
	}
	if in.PerformedByStaffID == nil || *in.PerformedByStaffID == 0 {
		return CareRecord{}, apperr.New(apperr.InvalidInput).WithDetails(
			apperr.Detail{Field: "performed_by_staff_id", Message: "実施者は必須です。"},
		)
	}
	rec := in
	rec.ID = s.nextCareRecordID
	s.nextCareRecordID++
	h.CareRecords = append(h.CareRecords, rec)
	s.hospByID[hospID] = h
	return rec, nil
}

var jstLoc = time.FixedZone("JST", 9*60*60)
