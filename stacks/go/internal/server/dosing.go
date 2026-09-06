package server

import (
	"net/http"
	"strconv"

	"clinicops/internal/clinical"
)

// この節は「投薬」画面（GET+POST /animals/{karte_no}/dosing/{kind_id}）を受け持つ。
// spec/screens.md 11章: 年度×月のマス目に実施した月へ印を付けるだけの記録
// （担当医・メモは持たない）。

// resolveKind は {kind_id} を種別マスタへ解決する。
//
// 契約（spec/openapi.yaml DosingKindId / PreventionKindId）は type: integer
// （マスタの行id）だが、`data/seed.json` の dosings/preventions は数値idを持たず
// `kind` にコード文字列（例: "heartworm"）しか持たない。共通テストの在庫検査
// （tests/inventory.py）は実データから引いた値をそのまま埋めるため、
// 数値id（配列順の1始まり）とコード文字列の両方を受け付ける
// （coordination/qa/lane-a.md 参照。dosing・prevention は同じマスタを共有する）。
func (s *Server) resolveKind(raw string) (clinical.PreventionKind, bool) {
	if id, err := strconv.Atoi(raw); err == nil {
		if k, ok := s.clinical.PreventionKindByID(id); ok {
			return k, true
		}
	}
	return s.clinical.PreventionKindByCode(raw)
}

type dosingRowView struct {
	FiscalYear int
	Months     [12]string
}

type dosingView struct {
	KarteNo      string
	KindID       int
	KindName     string
	Rows         []dosingRowView
	NewYear      string
	ErrorMessage string
}

func (s *Server) handleDosing(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		http.NotFound(w, r)
		return
	}
	karteNo := r.PathValue("karte_no")
	patient, ok := s.clinical.PatientByKarteNo(karteNo)
	if !ok {
		http.NotFound(w, r)
		return
	}
	kind, ok := s.resolveKind(r.PathValue("kind_id"))
	if !ok {
		http.NotFound(w, r)
		return
	}

	if r.Method == http.MethodPost {
		_ = r.ParseForm()
		fiscalYear, _ := strconv.Atoi(r.FormValue("fiscal_year"))
		var months [12]string
		for i := 0; i < 12; i++ {
			key := "m" + pad2(i+1)
			// チェックボックスの規約: 送られた値がそのまま「その月の印」になる。
			// 送られなかった月は空文字（外れた状態）として扱う
			// （spec/screens.md「送られなかった月と外した月を混同しない」——
			// この実装ではフォーム側が m01〜m12 を毎回すべて送ることで区別する）。
			months[i] = r.FormValue(key)
		}
		if fiscalYear != 0 {
			_, _ = s.clinical.SaveDosing(patient.ID, kind.Code, fiscalYear, months)
		}
	}

	data := dosingView{KarteNo: karteNo, KindID: kind.ID, KindName: kind.Name}
	for _, d := range s.clinical.Dosings(patient.ID, kind.Code) {
		data.Rows = append(data.Rows, dosingRowView{
			FiscalYear: d.FiscalYear,
			Months:     [12]string{d.M01, d.M02, d.M03, d.M04, d.M05, d.M06, d.M07, d.M08, d.M09, d.M10, d.M11, d.M12},
		})
	}
	_ = s.views.RenderHTTP(w, http.StatusOK, "dosing", data)
}

func pad2(n int) string {
	if n < 10 {
		return "0" + strconv.Itoa(n)
	}
	return strconv.Itoa(n)
}
