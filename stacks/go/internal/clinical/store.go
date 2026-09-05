package clinical

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
)

// Store は `data/` から読み込んだ内容をメモリ上に持つ（読み取り専用）。
type Store struct {
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

// PatientByKarteNo はカルテ番号で患者を引く。
func (s *Store) PatientByKarteNo(karteNo string) (Patient, bool) {
	p, ok := s.patientsByKarteNo[karteNo]
	return p, ok
}

// PatientByID はID で患者を引く。
func (s *Store) PatientByID(id int) (Patient, bool) {
	p, ok := s.patientsByID[id]
	return p, ok
}

// Visits は指定した患者の診察を新しい順で返す。
// includeDeleted が false のときは deleted_at が入っているものを除く
// （spec/screens.md「削除された Visit は診察一覧にもカルテ本体にも出ない」）。
func (s *Store) Visits(patientID int, includeDeleted bool) []Visit {
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

// ProgressNotes は指定した診察の経過記録を row_no 順で返す。
func (s *Store) ProgressNotes(visitID int) []ProgressNote {
	return s.notesByVisitID[visitID]
}

// LabTest はID で検査1件を引く。
func (s *Store) LabTest(id int) (LabTest, bool) {
	t, ok := s.labTestsByID[id]
	return t, ok
}

// LabTestItems は指定した検査の項目値を返す。
func (s *Store) LabTestItems(labTestID int) []LabTestItem {
	return s.labItemsByLabTest[labTestID]
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
