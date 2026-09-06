package clinical

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
)

// Store は `data/` から読み込んだ内容をメモリ上に持つ。
//
// 領域2（診療）が担当する範囲では保存（書き込み）まで動かす必要がある
// （spec/README.md「保存について」）。保存先（RDB等）は指揮役がまだ決めていないため、
// ここではプロセス内メモリへ `mu` で守って書く形にしてある。永続化の道具を
// 差し替えるときは、この構造体の中身だけを差し替えれば済むようにしてある
// （呼び出し側のメソッドシグネチャは変えずに済む設計）。
type Store struct {
	mu sync.RWMutex

	patientsByKarteNo map[string]Patient
	patientsByID      map[int]Patient
	visitsByPatientID map[int][]Visit // deleted_at ありも含む。表示側で除く
	visitsByID        map[int]Visit
	notesByVisitID    map[int][]ProgressNote
	labTestsByID      map[int]LabTest
	labItemsByLabTest map[int][]LabTestItem
	labItemMaster     map[string]LabItemMaster
	reservations      []Reservation
	hospByID          map[int]Hospitalization

	dosings         []Dosing
	preventions     []Prevention
	papers          []Paper
	noPaperPatients map[int]bool

	preventionKinds      []PreventionKind
	preventionKindByID   map[int]PreventionKind
	preventionKindByCode map[string]PreventionKind

	nextVisitID        int
	nextProgressNoteID int
	nextLabTestID      int
	nextLabTestItemID  int
	nextDosingID       int
	nextPreventionID   int
	nextPaperID        int
	nextReservationID  int
	nextCareRecordID   int
}

// Load は dataDir から seed.json と lab_items.json を読み込む。
// dataDir の解決は internal/billing.ResolveDataDir を使う想定
// （同じ `data/` を指すため、探索ロジックを2か所に持たない）。
func Load(dataDir string) (*Store, error) {
	var seed seedFile
	if err := readJSON(filepath.Join(dataDir, "seed.json"), &seed); err != nil {
		return nil, err
	}
	var masters []LabItemMaster
	if err := readJSON(filepath.Join(dataDir, "lab_items.json"), &masters); err != nil {
		return nil, err
	}
	var mf mastersFile
	if err := readJSON(filepath.Join(dataDir, "masters.json"), &mf); err != nil {
		return nil, err
	}

	s := &Store{
		patientsByKarteNo: make(map[string]Patient, len(seed.Patients)),
		patientsByID:      make(map[int]Patient, len(seed.Patients)),
		visitsByPatientID: make(map[int][]Visit),
		visitsByID:        make(map[int]Visit, len(seed.Visits)),
		notesByVisitID:    make(map[int][]ProgressNote),
		labTestsByID:      make(map[int]LabTest, len(seed.LabTests)),
		labItemsByLabTest: make(map[int][]LabTestItem),
		labItemMaster:     make(map[string]LabItemMaster, len(masters)),
		reservations:      seed.Reservations,
		hospByID:          make(map[int]Hospitalization, len(seed.Hospitalizations)),
		dosings:           append([]Dosing(nil), seed.Dosings...),
		preventions:       append([]Prevention(nil), seed.Preventions...),
		papers:            nil,
		noPaperPatients:   make(map[int]bool),
	}

	s.preventionKindByID = make(map[int]PreventionKind, len(mf.PreventionKinds))
	s.preventionKindByCode = make(map[string]PreventionKind, len(mf.PreventionKinds))
	for i, k := range mf.PreventionKinds {
		pk := PreventionKind{ID: i + 1, Code: k.Code, Name: k.Name}
		s.preventionKinds = append(s.preventionKinds, pk)
		s.preventionKindByID[pk.ID] = pk
		s.preventionKindByCode[pk.Code] = pk
	}
	for _, p := range seed.Patients {
		s.patientsByKarteNo[p.KarteNo] = p
		s.patientsByID[p.ID] = p
	}
	for _, v := range seed.Visits {
		s.visitsByPatientID[v.PatientID] = append(s.visitsByPatientID[v.PatientID], v)
		s.visitsByID[v.ID] = v
	}
	for pid, vs := range s.visitsByPatientID {
		vs := vs
		sort.Slice(vs, func(i, j int) bool {
			if vs[i].VisitDate != vs[j].VisitDate {
				return vs[i].VisitDate > vs[j].VisitDate // 新しい順
			}
			return vs[i].VisitNo > vs[j].VisitNo
		})
		s.visitsByPatientID[pid] = vs
	}
	for _, n := range seed.ProgressNotes {
		s.notesByVisitID[n.VisitID] = append(s.notesByVisitID[n.VisitID], n)
	}
	for vid, ns := range s.notesByVisitID {
		ns := ns
		sort.Slice(ns, func(i, j int) bool { return ns[i].RowNo < ns[j].RowNo })
		s.notesByVisitID[vid] = ns
	}
	for _, t := range seed.LabTests {
		s.labTestsByID[t.ID] = t
	}
	for _, it := range seed.LabTestItems {
		s.labItemsByLabTest[it.LabTestID] = append(s.labItemsByLabTest[it.LabTestID], it)
	}
	for _, m := range masters {
		s.labItemMaster[m.ItemCode] = m
	}
	for _, h := range seed.Hospitalizations {
		s.hospByID[h.ID] = h
	}
	for _, sp := range seed.Papers {
		var createdAt string
		if sp.TakenOn != "" {
			createdAt = sp.TakenOn + "T00:00:00+09:00"
		}
		s.papers = append(s.papers, Paper{
			ID:        sp.ID,
			PatientID: sp.PatientID,
			Title:     sp.Title,
			Note:      sp.Note,
			CreatedAt: createdAt,
			DeletedAt: sp.RemovedAt,
		})
	}
	for _, pid := range seed.NoPaperPatientIDs {
		s.noPaperPatients[pid] = true
	}

	s.nextVisitID = maxID(seed.Visits, func(v Visit) int { return v.ID }) + 1
	s.nextProgressNoteID = maxID(seed.ProgressNotes, func(n ProgressNote) int { return n.ID }) + 1
	s.nextLabTestID = maxID(seed.LabTests, func(t LabTest) int { return t.ID }) + 1
	s.nextLabTestItemID = maxID(seed.LabTestItems, func(it LabTestItem) int { return it.ID }) + 1
	s.nextDosingID = maxID(seed.Dosings, func(d Dosing) int { return d.ID }) + 1
	s.nextPreventionID = maxID(seed.Preventions, func(p Prevention) int { return p.ID }) + 1
	s.nextPaperID = maxID(seed.Papers, func(p seedPaper) int { return p.ID }) + 1
	s.nextReservationID = maxID(seed.Reservations, func(r Reservation) int { return r.ID }) + 1
	maxCare := 0
	for _, h := range seed.Hospitalizations {
		for _, c := range h.CareRecords {
			if c.ID > maxCare {
				maxCare = c.ID
			}
		}
	}
	s.nextCareRecordID = maxCare + 1

	return s, nil
}

// maxID は集合の最大IDを返す（空なら0）。新規採番の起点を決めるためだけに使う。
func maxID[T any](items []T, id func(T) int) int {
	max := 0
	for _, it := range items {
		if v := id(it); v > max {
			max = v
		}
	}
	return max
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

// PatientByKarteNo はカルテ番号で患者を引く。
func (s *Store) PatientByKarteNo(karteNo string) (Patient, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.patientsByKarteNo[karteNo]
	return p, ok
}

// PatientByID はID で患者を引く。
func (s *Store) PatientByID(id int) (Patient, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.patientsByID[id]
	return p, ok
}

// Visits は指定した患者の診察を新しい順で返す。
// includeDeleted が false のときは deleted_at が入っているものを除く
// （spec/screens.md「削除された Visit は診察一覧にもカルテ本体にも出ない」）。
func (s *Store) Visits(patientID int, includeDeleted bool) []Visit {
	s.mu.RLock()
	defer s.mu.RUnlock()
	all := s.visitsByPatientID[patientID]
	out := make([]Visit, 0, len(all))
	for _, v := range all {
		if !includeDeleted && v.DeletedAt != nil {
			continue
		}
		out = append(out, v)
	}
	return out
}

// VisitByID はIDで診察1件を引く（削除済みも引ける。JSON API向け）。
func (s *Store) VisitByID(id int) (Visit, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	v, ok := s.visitsByID[id]
	return v, ok
}

// ProgressNotes は指定した診察の経過記録を row_no 順で返す。
func (s *Store) ProgressNotes(visitID int) []ProgressNote {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]ProgressNote(nil), s.notesByVisitID[visitID]...)
}

// LabTest はID で検査1件を引く。
func (s *Store) LabTest(id int) (LabTest, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	t, ok := s.labTestsByID[id]
	return t, ok
}

// LabTestItems は指定した検査の項目値を返す。
func (s *Store) LabTestItems(labTestID int) []LabTestItem {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]LabTestItem(nil), s.labItemsByLabTest[labTestID]...)
}

// RefRangeFor は検査項目・種別・性別から基準値を引く。
// 見つからなければ ok=false（この場合は判定を付けない — spec/acceptance.md 検算5）。
//
// 手順は tests/expected.py の `_ref_range` と同じにしてある。判定側で
// 期待値の計算方法とロジックが割れると、実装のバグを検算のバグで隠してしまうため。
func (s *Store) RefRangeFor(itemCode, species, sex string) (RefRange, bool) {
	m, ok := s.labItemMaster[itemCode]
	if !ok {
		return RefRange{}, false
	}
	for _, r := range m.ReferenceRanges {
		if r.Species == species && (r.Sex == "any" || r.Sex == sex) {
			return r, true
		}
	}
	for _, r := range m.ReferenceRanges {
		if r.Species == "other" {
			return r, true
		}
	}
	return RefRange{}, false
}

// LabItemMasterFor は検査項目マスタ（名称・単位）を引く。
func (s *Store) LabItemMasterFor(itemCode string) (LabItemMaster, bool) {
	m, ok := s.labItemMaster[itemCode]
	return m, ok
}

// AllLabItemMasters は検査項目マスタの全件を item_code 順で返す
// （新規検査フォームの項目一覧に使う。マスタは画面から編集しない —
// spec/model.md「変わらないもの」）。
func (s *Store) AllLabItemMasters() []LabItemMaster {
	out := make([]LabItemMaster, 0, len(s.labItemMaster))
	for _, m := range s.labItemMaster {
		out = append(out, m)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ItemCode < out[j].ItemCode })
	return out
}

// Reservations は予約の全件を返す（データ側の並び順のまま）。
func (s *Store) Reservations() []Reservation {
	return s.reservations
}

// Hospitalization はID で入院1件を引く。
func (s *Store) Hospitalization(id int) (Hospitalization, bool) {
	h, ok := s.hospByID[id]
	return h, ok
}

// Hospitalizations は入院の全件を返す。
func (s *Store) Hospitalizations() []Hospitalization {
	out := make([]Hospitalization, 0, len(s.hospByID))
	for _, h := range s.hospByID {
		out = append(out, h)
	}
	return out
}
