package billing

import (
	"sort"
	"strings"
)

// DMRow は DM画面（spec/screens.md 16）・`/dm.csv`・`/api/dm` が共通で使う1行。
// spec/openapi.yaml の DmRow スキーマに対応する。
type DMRow struct {
	KarteNo          string
	OwnerNameKanji   string
	PatientNameKanji string
	Kind             string // prevention_kinds の code
	KindName         string // 表示名（無ければ code のまま）
	NextDueDate      *string
	PerformedDate    string
}

// DMFilter は DM の絞り込み条件。
//
// Field は "next_due_date"（既定）または "performed_date"。対象日付欄が
// これで決まる。Kind は空文字なら絞り込まない（spec/openapi.yaml の `type`
// パラメータに対応する。実データの種別コードは文字列であるため、この実装では
// 数値ではなく `data/masters.json` の prevention_kinds.code をそのまま渡す
// — 契約書の型宣言との食い違いは NOTES.md に記録する）。
// From/To は空文字なら無制限（両端含む、JSTの暦日文字列同士の比較で足りる）。
type DMFilter struct {
	Kind  string
	Field string
	From  string
	To    string
}

// normalizedField は既定値を補ったフィールド名を返す。
func (f DMFilter) normalizedField() string {
	if f.Field == "performed_date" {
		return "performed_date"
	}
	return "next_due_date"
}

// DMRows は絞り込み条件に合う予防記録を返す（画面・CSV・APIで共通の1本）。
//   - `deleted_at` が入っている Patient／Owner に紐づく記録は出さない
//   - 対象欄（next_due_date／performed_date）が空の記録は出さない
//     （next_due_date が既定なので「次回予定日が無い記録は出ない」を自然に満たす。
//     performed_date は必須項目なので、この条件で除かれることは無い）
//   - 期間は対象欄の値で両端含む
func (s *Store) DMRows(f DMFilter) []DMRow {
	s.mu.RLock()
	defer s.mu.RUnlock()

	field := f.normalizedField()
	var out []DMRow
	for _, p := range s.preventions {
		if f.Kind != "" && p.Kind != f.Kind {
			continue
		}
		var target string
		switch field {
		case "performed_date":
			target = p.PerformedDate
		default:
			if p.NextDueDate == nil {
				continue
			}
			target = *p.NextDueDate
		}
		if target == "" {
			continue
		}
		if f.From != "" && target < f.From {
			continue
		}
		if f.To != "" && target > f.To {
			continue
		}

		patient, ok := s.patientsByID[p.PatientID]
		if !ok || patient.DeletedAt != nil {
			continue
		}
		owner, ok := s.ownersByID[patient.OwnerID]
		if !ok || owner.DeletedAt != nil {
			continue
		}

		out = append(out, DMRow{
			KarteNo:          patient.KarteNo,
			OwnerNameKanji:   owner.NameKanji,
			PatientNameKanji: patient.NameKanji,
			Kind:             p.Kind,
			KindName:         s.preventionNameFor(p.Kind),
			NextDueDate:      p.NextDueDate,
			PerformedDate:    p.PerformedDate,
		})
	}

	sort.Slice(out, func(i, j int) bool {
		di, dj := dmSortKey(out[i], field), dmSortKey(out[j], field)
		if di != dj {
			return di < dj
		}
		return out[i].KarteNo < out[j].KarteNo
	})
	return out
}

func dmSortKey(r DMRow, field string) string {
	if field == "performed_date" {
		return r.PerformedDate
	}
	if r.NextDueDate == nil {
		return ""
	}
	return *r.NextDueDate
}

func (s *Store) preventionNameFor(kind string) string {
	if name, ok := s.preventionName[kind]; ok {
		return name
	}
	return kind
}

// DMCSV は DMRows と同じ絞り込み・同じ並びの結果を CSV（UTF-8, LF）にする。
// 画面（/dm）とCSV（/dm.csv）の件数・並びが完全一致することが検算条件
// （spec/screens.md 16）なので、行データの組み立ては必ずこの関数に通す。
// DMCSV は `/dm.csv`・`/api/dm` が共通で使う絞り込み結果をCSVの本文に組み立てる。
//
// `spec/README.md`「CSVの文字コード」は **UTF-8 BOMつき・改行はCRLF** と決めている
// （Excelで開いたときに文字化けさせないため）。以前は改行がLFのみでBOMも無く、
// この契約に反していた（レーンR 5巡目レビュー）。BOMはこの関数の呼び出し側
// （HTTP応答本文の先頭）で付ける — 文字列としての扱いやすさのため、
// この関数自体はBOMを含まない本文だけを返す。
func DMCSV(rows []DMRow) string {
	var b strings.Builder
	b.WriteString("karte_no,owner_name_kanji,patient_name_kanji,kind,next_due_date,performed_date\r\n")
	for _, r := range rows {
		next := ""
		if r.NextDueDate != nil {
			next = *r.NextDueDate
		}
		fields := []string{r.KarteNo, r.OwnerNameKanji, r.PatientNameKanji, r.KindName, next, r.PerformedDate}
		for i, f := range fields {
			if i > 0 {
				b.WriteByte(',')
			}
			b.WriteString(csvEscape(f))
		}
		b.WriteString("\r\n")
	}
	return b.String()
}

// UTF8BOM はCSV本文の先頭に付けるUTF-8のBOM（EF BB BF）。
// 生の3バイトを文字コードで書く（エディタ・差分ツールで見えない文字として
// 消えたり壊れたりしないようにするため）。
const UTF8BOM = "\xEF\xBB\xBF"

func csvEscape(s string) string {
	if strings.ContainsAny(s, ",\"\n") {
		return `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
	}
	return s
}
