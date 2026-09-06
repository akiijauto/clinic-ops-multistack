package clinical

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// newTestStore は最小限のデータで Store を組み立てる（internal/billing の
// store_test.go と同じ考え方。各テストは自分の検算に要る行だけを足す）。
func newTestStore(t *testing.T, seed map[string]any, labItems []map[string]any, masters map[string]any) *Store {
	t.Helper()
	dir := t.TempDir()
	writeJSON(t, filepath.Join(dir, "seed.json"), seed)
	writeJSON(t, filepath.Join(dir, "lab_items.json"), labItems)
	writeJSON(t, filepath.Join(dir, "masters.json"), masters)

	s, err := Load(dir)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	return s
}

func writeJSON(t *testing.T, path string, v any) {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshal %s: %v", path, err)
	}
	if err := os.WriteFile(path, b, 0o644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}

func baseSeed() map[string]any {
	return map[string]any{
		"patients": []map[string]any{
			{"id": 1, "karte_no": "1-1", "owner_id": 1, "name_kana": "ﾎﾟﾁ", "name_kanji": "ポチ",
				"species": "犬", "breed": "柴犬", "sex": "male"},
			{"id": 2, "karte_no": "1-2", "owner_id": 1, "name_kana": "ﾀﾏ", "name_kanji": "タマ",
				"species": "猫", "breed": "雑種", "sex": "female"},
		},
		"visits":           []map[string]any{},
		"progress_notes":   []map[string]any{},
		"lab_tests":        []map[string]any{},
		"lab_test_items":   []map[string]any{},
		"reservations":     []map[string]any{},
		"hospitalizations": []map[string]any{},
		"dosings":          []map[string]any{},
		"preventions":      []map[string]any{},
	}
}

func baseMasters() map[string]any {
	return map[string]any{
		"prevention_kinds": []map[string]any{
			{"code": "vaccine_core", "name": "混合ワクチン"},
			{"code": "heartworm", "name": "フィラリア予防"},
		},
	}
}

func TestSaveVisit_CreateThenUpdate_NotesDoNotLeakAcrossVisits(t *testing.T) {
	s := newTestStore(t, baseSeed(), nil, baseMasters())

	v1, err := s.SaveVisit(1, 0, Visit{VisitDate: "2026-09-01", ChiefComplaint: "元気消失"},
		[]ProgressNote{{EntryDate: "2026-09-01", TemperatureC: f(38.5)}})
	if err != nil {
		t.Fatalf("create v1: %v", err)
	}
	if v1.VisitNo != 1 {
		t.Fatalf("visit_no = %d, want 1", v1.VisitNo)
	}

	v2, err := s.SaveVisit(2, 0, Visit{VisitDate: "2026-09-02", ChiefComplaint: "嘔吐"},
		[]ProgressNote{{EntryDate: "2026-09-02", TemperatureC: f(39.9)}})
	if err != nil {
		t.Fatalf("create v2: %v", err)
	}

	n1 := s.ProgressNotes(v1.ID)
	n2 := s.ProgressNotes(v2.ID)
	if len(n1) != 1 || len(n2) != 1 {
		t.Fatalf("note counts = %d, %d", len(n1), len(n2))
	}
	if *n1[0].TemperatureC == *n2[0].TemperatureC {
		t.Fatalf("同じ体温が2患者に出ている（不具合の再発）: %v", *n1[0].TemperatureC)
	}

	// 更新：既存 visit を新しい行数の notes で丸ごと置き換える
	updated, err := s.SaveVisit(1, v1.ID, Visit{VisitDate: "2026-09-01", ChiefComplaint: "元気消失（再診）"},
		[]ProgressNote{
			{EntryDate: "2026-09-01", TemperatureC: f(38.5)},
			{EntryDate: "2026-09-02", TemperatureC: f(38.7)},
		})
	if err != nil {
		t.Fatalf("update v1: %v", err)
	}
	if updated.ID != v1.ID {
		t.Fatalf("update すると別の visit id になった: %d != %d", updated.ID, v1.ID)
	}
	notes := s.ProgressNotes(v1.ID)
	if len(notes) != 2 {
		t.Fatalf("更新後の行数 = %d, want 2", len(notes))
	}
	if notes[0].RowNo != 1 || notes[1].RowNo != 2 {
		t.Fatalf("row_no が振り直されていない: %+v", notes)
	}
}

func TestSaveVisit_UnknownVisitID_NotFound(t *testing.T) {
	s := newTestStore(t, baseSeed(), nil, baseMasters())
	_, err := s.SaveVisit(1, 9999, Visit{VisitDate: "2026-09-01"}, nil)
	if err == nil {
		t.Fatal("存在しない visit_id を更新できてしまった")
	}
}

func TestDeleteVisit_RestoreVisit(t *testing.T) {
	s := newTestStore(t, baseSeed(), nil, baseMasters())
	v, _ := s.SaveVisit(1, 0, Visit{VisitDate: "2026-09-01"}, nil)

	if _, err := s.DeleteVisit(v.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	visible := s.Visits(1, false)
	for _, vv := range visible {
		if vv.ID == v.ID {
			t.Fatal("削除済みが既定表示に出ている")
		}
	}
	all := s.Visits(1, true)
	found := false
	for _, vv := range all {
		if vv.ID == v.ID {
			found = true
			if vv.DeletedAt == nil {
				t.Fatal("deleted_at が入っていない")
			}
		}
	}
	if !found {
		t.Fatal("削除済みも表示で行が消えている（物理削除してしまっている）")
	}

	if _, err := s.RestoreVisit(v.ID); err != nil {
		t.Fatalf("restore: %v", err)
	}
	visible = s.Visits(1, false)
	found = false
	for _, vv := range visible {
		if vv.ID == v.ID {
			found = true
		}
	}
	if !found {
		t.Fatal("復元後、既定表示に戻っていない")
	}
}

func TestPreviousVisit(t *testing.T) {
	s := newTestStore(t, baseSeed(), nil, baseMasters())
	if _, ok := s.PreviousVisit(1); ok {
		t.Fatal("診察が無いのに前回があると言っている")
	}
	first, _ := s.SaveVisit(1, 0, Visit{VisitDate: "2026-09-01"}, nil)
	second, _ := s.SaveVisit(1, 0, Visit{VisitDate: "2026-09-05"}, nil)
	prev, ok := s.PreviousVisit(1)
	if !ok || prev.ID != second.ID {
		t.Fatalf("前回コピーの対象が最新でない: got=%d want=%d", prev.ID, second.ID)
	}
	_ = first
}

func TestCreateLabTest_JudgmentUsesEvaluate(t *testing.T) {
	labItems := []map[string]any{
		{
			"item_code": "WBC",
			"name":      "白血球数",
			"unit":      "10^3/uL",
			"category":  "血液",
			"reference_ranges": []map[string]any{
				{"species": "犬", "sex": "any", "low": 6.0, "high": 17.0},
			},
		},
	}
	s := newTestStore(t, baseSeed(), labItems, baseMasters())
	patient, _ := s.PatientByKarteNo("1-1")

	created, err := s.CreateLabTest(patient.ID, LabTest{VisitID: 1, Category: "血液", TestedOn: "2026-09-06"},
		[]LabTestItem{{ItemCode: "WBC", ValueNum: f(20.0)}})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	items := s.LabTestItems(created.ID)
	if len(items) != 1 {
		t.Fatalf("items = %d, want 1", len(items))
	}
	j := s.Evaluate(items[0], patient.Species, patient.Sex)
	if j.Value != "H" || j.Flag != "high" {
		t.Fatalf("judgment = %q flag=%q, want H/high", j.Value, j.Flag)
	}
}

func TestSaveDosing_CreateAndUpdate_OtherRowsUnaffected(t *testing.T) {
	s := newTestStore(t, baseSeed(), nil, baseMasters())
	months := [12]string{"", "○", "", "", "", "", "", "", "", "", "", ""}
	d, err := s.SaveDosing(1, "heartworm", 2026, months)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if d.M02 != "○" {
		t.Fatalf("M02 = %q", d.M02)
	}

	// 別年度・別種別の行を作る
	other := [12]string{"○", "○", "○", "○", "○", "○", "○", "○", "○", "○", "○", "○"}
	if _, err := s.SaveDosing(1, "vaccine_core", 2025, other); err != nil {
		t.Fatalf("create other: %v", err)
	}

	// 元の行のチェックを外す（送られなかった月と外した月を区別する：全部を送る）
	updatedMonths := [12]string{"", "", "", "", "", "", "", "", "", "", "", ""}
	updated, err := s.SaveDosing(1, "heartworm", 2026, updatedMonths)
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if updated.M02 != "" {
		t.Fatalf("チェックを外した月が残っている: %q", updated.M02)
	}

	rows := s.Dosings(1, "vaccine_core")
	if len(rows) != 1 || rows[0].M01 != "○" {
		t.Fatalf("他の年度・種別の行が変化した: %+v", rows)
	}
}

func TestSaveDosing_NoFiscalYear_DoesNotCreateRow(t *testing.T) {
	s := newTestStore(t, baseSeed(), nil, baseMasters())
	before := len(s.Dosings(1, "heartworm"))
	if _, err := s.SaveDosing(1, "heartworm", 0, [12]string{}); err == nil {
		t.Fatal("年度未入力で保存できてしまった")
	}
	after := len(s.Dosings(1, "heartworm"))
	if before != after {
		t.Fatalf("行が増えている: before=%d after=%d", before, after)
	}
}

func TestCreatePrevention_NextDueDateEmptyWithoutCycle(t *testing.T) {
	s := newTestStore(t, baseSeed(), nil, baseMasters())
	p, err := s.CreatePrevention(1, Prevention{Kind: "vaccine_core", Content: "混合ワクチン", PerformedDate: "2026-09-01"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if p.NextDueDate != nil {
		t.Fatalf("周期マスタが無いのに次回予定日が自動計算されている: %v", *p.NextDueDate)
	}

	due := "2026-10-01"
	p2, err := s.CreatePrevention(1, Prevention{Kind: "vaccine_core", PerformedDate: "2026-09-01", NextDueDate: &due})
	if err != nil {
		t.Fatalf("create2: %v", err)
	}
	if p2.NextDueDate == nil || *p2.NextDueDate != due {
		t.Fatal("入力した次回予定日が優先されていない")
	}

	rows := s.Preventions(1, "vaccine_core")
	if len(rows) != 2 {
		t.Fatalf("rows = %d, want 2", len(rows))
	}
}

func TestPapers_PDFOnlyAndSoftDelete(t *testing.T) {
	s := newTestStore(t, baseSeed(), nil, baseMasters())
	if _, err := s.CreatePaper(1, "karte.txt", nil); err == nil {
		t.Fatal("PDF以外を取り込めてしまった")
	}
	p, err := s.CreatePaper(1, "karte_2020.pdf", nil)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if len(s.Papers(1)) != 1 {
		t.Fatal("一覧に出ていない")
	}
	if _, err := s.RemovePaper(p.ID); err != nil {
		t.Fatalf("remove: %v", err)
	}
	if len(s.Papers(1)) != 0 {
		t.Fatal("取り消し後も一覧に出ている")
	}
	stored, ok := s.Paper(p.ID)
	if !ok {
		t.Fatal("取り消し後に行自体が消えている（物理削除してしまっている）")
	}
	if stored.DeletedAt == nil {
		t.Fatal("deleted_at が入っていない")
	}
}

func TestPreventionKinds_LoadedFromMasters(t *testing.T) {
	s := newTestStore(t, baseSeed(), nil, baseMasters())
	kinds := s.PreventionKinds()
	if len(kinds) != 2 {
		t.Fatalf("kinds = %d, want 2", len(kinds))
	}
	k, ok := s.PreventionKindByID(1)
	if !ok || k.Code != "vaccine_core" {
		t.Fatalf("id=1 の種別が一致しない: %+v", k)
	}
}

func f(v float64) *float64 { return &v }
