package server

import (
	"net/http"
	"strconv"

	"clinicops/internal/clinical"
)

// labTestItemJSON は検査項目1件の応答。
//
// 契約の書き方がここでも食い違っている（coordination/qa/lane-a.md Q-A-09）:
//   - spec/openapi.yaml は `judgement`（low/normal/high/unknown）と `out_of_range`（真偽）
//   - 共通テスト（tests/checks.py）は `judgment`（つづりが違う。値は ""/"H"/"L"）を読む
//
// billing と同じ理由で、両方の名前を同時に返す。
type labTestItemJSON struct {
	ID            int      `json:"id"`
	LabTestID     int      `json:"lab_test_id"`
	ItemCode      string   `json:"item_code"`
	ValueNum      *float64 `json:"value_num"`
	ValueText     *string  `json:"value_text"`
	ReferenceLow  *float64 `json:"reference_low"`
	ReferenceHigh *float64 `json:"reference_high"`

	// openapi.yaml 側の名前。
	Judgement  string `json:"judgement"`
	OutOfRange bool   `json:"out_of_range"`

	// tests/checks.py が読む名前。
	Judgment string `json:"judgment"`
	Flag     string `json:"data_check_flag"`
}

type labTestJSON struct {
	ID           int               `json:"id"`
	PatientID    int               `json:"patient_id"`
	VisitID      int               `json:"visit_id"`
	Category     string            `json:"category"`
	TestedOn     string            `json:"tested_on"`
	TestedAtTime *string           `json:"tested_at_time"`
	StaffID      *int              `json:"staff_id"`
	Items        []labTestItemJSON `json:"items"`
}

func (s *Server) handleGetLabTest(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		http.NotFound(w, r)
		return
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	test, ok := s.clinical.LabTest(id)
	if !ok {
		http.NotFound(w, r)
		return
	}
	writeJSON(w, http.StatusOK, s.buildLabTestJSON(test))
}

// buildLabTestJSON は LabTest とその項目（判定・基準値つき）をJSON表現へ組み立てる。
// `GET /api/lab-tests/{id}` と `POST /api/patients/{karte_no}/lab-tests` の両方が使う
// （同じ計算を2箇所に書かない）。
func (s *Server) buildLabTestJSON(test clinical.LabTest) labTestJSON {
	patient, _ := s.clinical.PatientByID(test.PatientID)
	items := s.clinical.LabTestItems(test.ID)
	out := make([]labTestItemJSON, len(items))
	for i, it := range items {
		j := s.clinical.Evaluate(it, patient.Species, patient.Sex)
		judgement := "unknown"
		switch j.Flag {
		case "normal":
			judgement = "normal"
		case "high":
			judgement = "high"
		case "low":
			judgement = "low"
		}
		out[i] = labTestItemJSON{
			ID:            it.ID,
			LabTestID:     it.LabTestID,
			ItemCode:      it.ItemCode,
			ValueNum:      it.ValueNum,
			ValueText:     it.ValueText,
			ReferenceLow:  j.Low,
			ReferenceHigh: j.High,
			Judgement:     judgement,
			OutOfRange:    j.Flag == "high" || j.Flag == "low",
			Judgment:      j.Value,
			Flag:          j.Flag,
		}
	}
	return labTestJSON{
		ID:           test.ID,
		PatientID:    test.PatientID,
		VisitID:      test.VisitID,
		Category:     test.Category,
		TestedOn:     test.TestedOn,
		TestedAtTime: test.TestedAtTime,
		StaffID:      test.StaffID,
		Items:        out,
	}
}
