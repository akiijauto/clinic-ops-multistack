package reception

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"

	"clinicops/internal/config"
)

// Store はこの領域が扱うデータをメモリ上に持つ。
//
// billing.Store / clinical.Store と違い、本領域は削除・番号変更・上下送り等の
// 書き込みを行うため、排他制御を持つ（同時アクセスで display_no の入れ替えが
// 壊れるのを防ぐ）。
type Store struct {
	mu sync.RWMutex

	staffByID map[int]Staff

	owners     map[int]*Owner
	ownersByNo map[string]*Owner

	patients        map[int]*Patient
	patientsByKarte map[string]*Patient

	receptions map[int]*Reception

	visits            []*Visit
	visitsByPatientID map[int][]*Visit

	receptionKinds []ReceptionKind

	nextReceptionID int
	nextPatientSeq  int // 次に払い出す karte_no（数値部分）
	nextOwnerSeq    int // 次に払い出す owner_no（数値部分）
}

// Load は dataDir から seed.json と masters.json を読み込む。
// dataDir の解決は internal/datadir.Resolve を使う（呼び出し側で解決済みの
// パスをそのまま渡してもよい）。
func Load(dataDir string) (*Store, error) {
	var seed seedFile
	if err := readJSON(filepath.Join(dataDir, "seed.json"), &seed); err != nil {
		return nil, err
	}
	var masters mastersFile
	if err := readJSON(filepath.Join(dataDir, "masters.json"), &masters); err != nil {
		return nil, err
	}

	s := &Store{
		staffByID:         make(map[int]Staff, len(seed.Staff)),
		owners:            make(map[int]*Owner, len(seed.Owners)),
		ownersByNo:        make(map[string]*Owner, len(seed.Owners)),
		patients:          make(map[int]*Patient, len(seed.Patients)),
		patientsByKarte:   make(map[string]*Patient, len(seed.Patients)),
		receptions:        make(map[int]*Reception, len(seed.Receptions)),
		visitsByPatientID: make(map[int][]*Visit),
		receptionKinds:    masters.ReceptionKinds,
	}

	for _, st := range seed.Staff {
		s.staffByID[st.ID] = st
	}
	for i := range seed.Owners {
		o := seed.Owners[i]
		s.owners[o.ID] = &o
		s.ownersByNo[o.OwnerNo] = &o
		if n, ok := trailingInt(o.OwnerNo); ok && n >= s.nextOwnerSeq {
			s.nextOwnerSeq = n + 1
		}
	}
	for i := range seed.Patients {
		p := seed.Patients[i]
		s.patients[p.ID] = &p
		s.patientsByKarte[p.KarteNo] = &p
		if n, err := strconv.Atoi(p.KarteNo); err == nil && n >= s.nextPatientSeq {
			s.nextPatientSeq = n + 1
		}
	}
	for i := range seed.Receptions {
		r := seed.Receptions[i]
		s.receptions[r.ID] = &r
		if r.ID >= s.nextReceptionID {
			s.nextReceptionID = r.ID + 1
		}
	}
	for i := range seed.Visits {
		v := seed.Visits[i]
		s.visits = append(s.visits, &v)
		s.visitsByPatientID[v.PatientID] = append(s.visitsByPatientID[v.PatientID], &v)
	}
	if s.nextOwnerSeq == 0 {
		s.nextOwnerSeq = 1
	}
	if s.nextPatientSeq == 0 {
		s.nextPatientSeq = 1
	}
	return s, nil
}

func readJSON(path string, v any) error {
	f, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("%s を開けない: %w", path, err)
	}
	defer f.Close()
	if err := json.NewDecoder(f).Decode(v); err != nil {
		return fmt.Errorf("%s を読めない: %w", path, err)
	}
	return nil
}

// trailingInt は "O-00041" のような文字列末尾の数字部分を取り出す。
func trailingInt(s string) (int, bool) {
	i := len(s)
	for i > 0 && s[i-1] >= '0' && s[i-1] <= '9' {
		i--
	}
	if i == len(s) {
		return 0, false
	}
	n, err := strconv.Atoi(s[i:])
	if err != nil {
		return 0, false
	}
	return n, true
}

// ---- 参照系 ----

// ReceptionKinds はタブに使う受付区分の一覧（`data/masters.json` の並び順）。
func (s *Store) ReceptionKinds() []ReceptionKind {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]ReceptionKind, len(s.receptionKinds))
	copy(out, s.receptionKinds)
	return out
}

// AllStaff はスタッフの全件を staff_code 順で返す（画面21「スタッフ」向け）。
func (s *Store) AllStaff() []Staff {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]Staff, 0, len(s.staffByID))
	for _, st := range s.staffByID {
		out = append(out, st)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].StaffCode < out[j].StaffCode })
	return out
}

// StaffByID はIDでスタッフ1件を引く。
func (s *Store) StaffByID(id int) (Staff, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	st, ok := s.staffByID[id]
	return st, ok
}

// StaffName は担当のIDから氏名を引く。未選択・不明なら空文字。
func (s *Store) StaffName(id *int) string {
	if id == nil {
		return ""
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	if st, ok := s.staffByID[*id]; ok {
		return st.Name
	}
	return ""
}

// PatientByKarteNo はカルテ番号で動物を引く（コピーを返す。呼び出し側での書き換えを防ぐ）。
func (s *Store) PatientByKarteNo(karteNo string) (Patient, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.patientsByKarte[karteNo]
	if !ok {
		return Patient{}, false
	}
	return *p, true
}

// OwnerByID は id で飼主を引く。
func (s *Store) OwnerByID(id int) (Owner, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	o, ok := s.owners[id]
	if !ok {
		return Owner{}, false
	}
	return *o, true
}

// OwnerByNo は owner_no で飼主を引く。
func (s *Store) OwnerByNo(ownerNo string) (Owner, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	o, ok := s.ownersByNo[ownerNo]
	if !ok {
		return Owner{}, false
	}
	return *o, true
}

// PatientsByOwnerID はその飼主が持つ動物を返す（削除済みを含む。呼び出し側で除く）。
func (s *Store) PatientsByOwnerID(ownerID int) []Patient {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var out []Patient
	for _, p := range s.patients {
		if p.OwnerID == ownerID {
			out = append(out, *p)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].KarteNo < out[j].KarteNo })
	return out
}

// PatientList は動物の一覧・検索（`api-reception` `PatientList`）。
func (s *Store) PatientList(q string, includeDeleted bool, limit, offset int) ([]Patient, int) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var matched []Patient
	qq := strings.ToLower(strings.TrimSpace(q))
	for _, p := range s.patients {
		if !includeDeleted && p.DeletedAt != nil {
			continue
		}
		if qq != "" && !patientMatches(*p, qq) {
			continue
		}
		matched = append(matched, *p)
	}
	sort.Slice(matched, func(i, j int) bool { return matched[i].KarteNo < matched[j].KarteNo })
	total := len(matched)
	if offset < 0 {
		offset = 0
	}
	if offset > total {
		offset = total
	}
	end := offset + limit
	if limit <= 0 || end > total {
		end = total
	}
	return matched[offset:end], total
}

func patientMatches(p Patient, qLower string) bool {
	if strings.Contains(strings.ToLower(p.NameKanji), qLower) {
		return true
	}
	if strings.Contains(strings.ToLower(p.NameKana), qLower) {
		return true
	}
	if strings.Contains(strings.ToLower(p.KarteNo), qLower) {
		return true
	}
	return false
}

// SearchOwnersAndPatients は「飼主・動物」一覧（画面4「検索」）。
// 氏名・カナ・karte_no・電話番号を横断する。
func (s *Store) SearchOwnersAndPatients(q string, includeDeleted bool) []PatientWithOwner {
	q = strings.TrimSpace(q)
	if q == "" {
		return nil
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	qLower := strings.ToLower(q)
	var out []PatientWithOwner
	for _, p := range s.patients {
		if !includeDeleted && p.DeletedAt != nil {
			continue
		}
		owner, ok := s.owners[p.OwnerID]
		if !ok {
			continue
		}
		if !includeDeleted && owner.DeletedAt != nil {
			continue
		}
		hit := patientMatches(*p, qLower) ||
			strings.Contains(strings.ToLower(owner.NameKanji), qLower) ||
			strings.Contains(strings.ToLower(owner.NameKana), qLower) ||
			strings.Contains(owner.Phone, q) ||
			strings.Contains(owner.Mobile, q)
		if !hit {
			continue
		}
		out = append(out, PatientWithOwner{Patient: *p, Owner: *owner})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Patient.KarteNo < out[j].Patient.KarteNo })
	return out
}

// SearchVisits は「診察の中身」一覧（画面4「検索」）。
// 主訴・症状・診断・処置を全文検索する。既定では削除済みを除く。
func (s *Store) SearchVisits(q string, includeDeleted bool) []VisitHit {
	q = strings.TrimSpace(q)
	if q == "" {
		return nil
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	qLower := strings.ToLower(q)
	var out []VisitHit
	for _, v := range s.visits {
		if !includeDeleted && v.DeletedAt != nil {
			continue
		}
		field, excerpt, ok := matchVisitText(*v, qLower)
		if !ok {
			continue
		}
		p, pok := s.patients[v.PatientID]
		if !pok {
			continue
		}
		out = append(out, VisitHit{Visit: *v, Patient: *p, Field: field, Excerpt: excerpt})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Visit.VisitDate != out[j].Visit.VisitDate {
			return out[i].Visit.VisitDate > out[j].Visit.VisitDate
		}
		return out[i].Visit.VisitNo > out[j].Visit.VisitNo
	})
	return out
}

func matchVisitText(v Visit, qLower string) (field, excerpt string, ok bool) {
	candidates := []struct {
		name string
		val  string
	}{
		{"chief_complaint", v.ChiefComplaint},
		{"symptom", v.Symptom},
		{"diagnosis", v.Diagnosis},
		{"treatment", v.Treatment},
	}
	for _, c := range candidates {
		idx := strings.Index(strings.ToLower(c.val), qLower)
		if idx < 0 {
			continue
		}
		return c.name, excerptAround(c.val, idx, len([]rune(qLower))), true
	}
	return "", "", false
}

// excerptAround は当たった位置の前後の文字を切り出す（rune単位。バイト数で数えない）。
func excerptAround(s string, byteIdx, matchRuneLen int) string {
	runes := []rune(s)
	// byteIdx はバイト位置なので rune 位置へ変換する。
	runeIdx := len([]rune(s[:byteIdx]))
	const context = 10
	start := runeIdx - context
	if start < 0 {
		start = 0
	}
	end := runeIdx + matchRuneLen + context
	if end > len(runes) {
		end = len(runes)
	}
	return string(runes[start:end])
}

// HistoryVisits はその患者の診察を新しい順で返す（削除済みも含む）。
func (s *Store) HistoryVisits(patientID int) []Visit {
	s.mu.RLock()
	defer s.mu.RUnlock()
	all := s.visitsByPatientID[patientID]
	out := make([]Visit, len(all))
	for i, v := range all {
		out[i] = *v
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].VisitDate != out[j].VisitDate {
			return out[i].VisitDate > out[j].VisitDate
		}
		if out[i].VisitTime != out[j].VisitTime {
			return out[i].VisitTime > out[j].VisitTime
		}
		return out[i].VisitNo > out[j].VisitNo
	})
	return out
}

// VisitCountOn は指定日（JSTの暦日、"YYYY-MM-DD"）に行われた診察の件数。
// 削除済み（deleted_at あり）も数える — spec/screens.md 検算9
// 「削除は一覧表示から隠すだけで、実績としての件数は減らない」。
func (s *Store) VisitCountOn(date string) int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	n := 0
	for _, v := range s.visits {
		if v.VisitDate == date {
			n++
		}
	}
	return n
}

// ---- 本日の患者（受付） ----

// ReceptionRow は一覧1行ぶんの表示用データ。
type ReceptionRow struct {
	Reception Reception
	Patient   Patient
	Owner     Owner
	StaffName string
}

// TodayList は指定日・受付区分でのReceptionを display_no 昇順
// （完了は下へ）で返す。kindName が空なら区分で絞らない。
// hideDone が true なら status=done を除く（一覧からは隠すだけで件数には影響しない）。
func (s *Store) TodayList(date, kindName string, hideDone bool) (rows []ReceptionRow, doneCount int) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var matched []Reception
	for _, r := range s.receptions {
		if receptionDate(r.ReceivedAt) != date {
			continue
		}
		if kindName != "" && (r.MedicalPurpose == nil || *r.MedicalPurpose != kindName) {
			continue
		}
		matched = append(matched, *r)
	}
	sort.Slice(matched, func(i, j int) bool {
		di, dj := matched[i].Status == "done", matched[j].Status == "done"
		if di != dj {
			return !di // 完了でない方を先に
		}
		return matched[i].DisplayNo < matched[j].DisplayNo
	})
	for _, r := range matched {
		if r.Status == "done" {
			doneCount++
		}
		if hideDone && r.Status == "done" {
			continue
		}
		p := s.patients[r.PatientID]
		if p == nil {
			continue
		}
		o := s.owners[p.OwnerID]
		row := ReceptionRow{Reception: r, StaffName: staffNameLocked(s, r.StaffID)}
		row.Patient = *p
		if o != nil {
			row.Owner = *o
		}
		rows = append(rows, row)
	}
	return rows, doneCount
}

func staffNameLocked(s *Store, id *int) string {
	if id == nil {
		return ""
	}
	if st, ok := s.staffByID[*id]; ok {
		return st.Name
	}
	return ""
}

// receptionDate は received_at（ISO8601, +09:00 前提）から "YYYY-MM-DD" を取り出す。
// タイムゾーン変換はせず、契約どおり値がJSTで来ることを前提にする
// （spec/openapi.yaml「すべて JST で扱う」）。
func receptionDate(receivedAt string) string {
	if len(receivedAt) < 10 {
		return receivedAt
	}
	return receivedAt[:10]
}

// TodayJST は現在の JST の暦日を "YYYY-MM-DD" で返す。
func TodayJST() string {
	return nowJST().In(config.JST).Format("2006-01-02")
}
