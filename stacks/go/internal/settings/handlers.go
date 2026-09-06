package settings

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"

	"clinicops/internal/apperr"
	"clinicops/internal/datadir"
	"clinicops/internal/view"
)

// Handlers はこの領域の画面・APIハンドラをまとめる。
type Handlers struct {
	store *Store
	views *view.Set
}

// New は dataDir（未解決のヒントでもよい。datadir.Resolve で探す）から
// データを読み込み、Handlers を組み立てる。
func New(dataDir string, views *view.Set) (*Handlers, error) {
	resolved, err := datadir.Resolve(dataDir, "seed.json")
	if err != nil {
		return nil, err
	}
	store, err := Load(resolved)
	if err != nil {
		return nil, err
	}
	return &Handlers{store: store, views: views}, nil
}

// ---- 26. このシステムについて -------------------------------------------

type aboutView struct{}

// About は GET /about。DBに繋がらなくても開ける（openapi.yaml 記載どおり、
// このハンドラは Store の読み書きに一切依らない）。
func (h *Handlers) About(w http.ResponseWriter, r *http.Request) {
	_ = h.views.RenderHTTP(w, http.StatusOK, "about", aboutView{})
}

// ---- 22. 設定（病院設定） --------------------------------------------

var weekdayLabels = []string{"月", "火", "水", "木", "金", "土", "日"}

type weekdayOption struct {
	Value   int
	Label   string
	Checked bool
}

type settingsView struct {
	Clinic   Clinic
	Weekdays []weekdayOption
	Success  string
	Error    string
}

func weekdayOptions(closed []int) []weekdayOption {
	set := make(map[int]bool, len(closed))
	for _, d := range closed {
		set[d] = true
	}
	out := make([]weekdayOption, 0, len(weekdayLabels))
	for i, label := range weekdayLabels {
		out = append(out, weekdayOption{Value: i, Label: label, Checked: set[i]})
	}
	return out
}

// Settings は GET/POST /settings。
func (h *Handlers) Settings(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		h.saveSettings(w, r)
		return
	}
	clinic := h.store.Clinic()
	_ = h.views.RenderHTTP(w, http.StatusOK, "settings", settingsView{
		Clinic:   clinic,
		Weekdays: weekdayOptions(clinic.ClosedWeekdays),
	})
}

func (h *Handlers) saveSettings(w http.ResponseWriter, r *http.Request) {
	current := h.store.Clinic()

	if err := r.ParseForm(); err != nil {
		h.renderSettingsError(w, current, apperr.Message(apperr.InvalidInput))
		return
	}

	next := Clinic{
		ID:           current.ID,
		Name:         strings.TrimSpace(r.FormValue("name")),
		PostalCode:   strings.TrimSpace(r.FormValue("postal_code")),
		Address1:     strings.TrimSpace(r.FormValue("address1")),
		Address2:     strings.TrimSpace(r.FormValue("address2")),
		Phone:        strings.TrimSpace(r.FormValue("phone")),
		Fax:          strings.TrimSpace(r.FormValue("fax")),
		DirectorName: strings.TrimSpace(r.FormValue("director_name")),
	}

	if next.Name == "" {
		h.renderSettingsErrorWithForm(w, next, current.ClosedWeekdays, apperr.Message(apperr.InvalidInput))
		return
	}

	slotMinutes, err := strconv.Atoi(strings.TrimSpace(r.FormValue("reservation_slot_minutes")))
	if err != nil || slotMinutes <= 0 {
		h.renderSettingsErrorWithForm(w, next, current.ClosedWeekdays, apperr.Message(apperr.InvalidInput))
		return
	}
	next.ReservationSlotMinutes = slotMinutes

	taxRate, err := strconv.ParseFloat(strings.TrimSpace(r.FormValue("tax_rate")), 64)
	if err != nil || taxRate < 0 {
		h.renderSettingsErrorWithForm(w, next, current.ClosedWeekdays, apperr.Message(apperr.InvalidInput))
		return
	}
	next.TaxRate = taxRate

	closed := make([]int, 0, len(r.Form["closed_weekdays"]))
	for _, v := range r.Form["closed_weekdays"] {
		d, err := strconv.Atoi(strings.TrimSpace(v))
		if err != nil || d < 0 || d > 6 {
			h.renderSettingsErrorWithForm(w, next, current.ClosedWeekdays, apperr.Message(apperr.InvalidInput))
			return
		}
		closed = append(closed, d)
	}
	next.ClosedWeekdays = closed

	saved := h.store.SaveClinic(next)
	_ = h.views.RenderHTTP(w, http.StatusOK, "settings", settingsView{
		Clinic:   saved,
		Weekdays: weekdayOptions(saved.ClosedWeekdays),
		Success:  "保存しました。",
	})
}

func (h *Handlers) renderSettingsError(w http.ResponseWriter, shown Clinic, message string) {
	_ = h.views.RenderHTTP(w, http.StatusOK, "settings", settingsView{
		Clinic:   shown,
		Weekdays: weekdayOptions(shown.ClosedWeekdays),
		Error:    message,
	})
}

func (h *Handlers) renderSettingsErrorWithForm(w http.ResponseWriter, shown Clinic, closedFallback []int, message string) {
	if shown.ClosedWeekdays == nil {
		shown.ClosedWeekdays = closedFallback
	}
	h.renderSettingsError(w, shown, message)
}

// ---- 23. 機能設定 -------------------------------------------------------

type featuresView struct {
	Notes []FeatureNote
}

// Features は GET /settings/features。読むだけ（ClinicFeature を持たないため
// 保存経路は無い — spec/model.md「落としたもの」）。
func (h *Handlers) Features(w http.ResponseWriter, r *http.Request) {
	_ = h.views.RenderHTTP(w, http.StatusOK, "settings_features", featuresView{Notes: FeatureNotes()})
}

// APIFeatures は GET /api/features。
func (h *Handlers) APIFeatures(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"items": FeatureNotes()})
}

// ---- 24. 取込 -------------------------------------------------------

type csvSurveyResult struct {
	Filename string
	Columns  []string
	Rows     int
}

type importView struct {
	Summaries []ImportSummary
	LoadedAt  string
	Survey    *csvSurveyResult
	Error     string
}

// Import は GET/POST /settings/import。
// POST はCSVの列名と件数だけを読んで返す。**中身は保存しない**
// （spec/screens.md 24章）。
func (h *Handlers) Import(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		h.surveyImport(w, r)
		return
	}
	h.renderImport(w, nil, "")
}

func (h *Handlers) renderImport(w http.ResponseWriter, survey *csvSurveyResult, errMsg string) {
	_ = h.views.RenderHTTP(w, http.StatusOK, "settings_import", importView{
		Summaries: h.store.ImportSummaries(),
		LoadedAt:  h.store.LoadedAt().Format("2006-01-02 15:04:05"),
		Survey:    survey,
		Error:     errMsg,
	})
}

func (h *Handlers) surveyImport(w http.ResponseWriter, r *http.Request) {
	file, header, err := r.FormFile("file")
	if err != nil {
		h.renderImport(w, nil, apperr.Message(apperr.InvalidInput))
		return
	}
	defer file.Close()

	survey, err := surveyCSV(file, header)
	if err != nil {
		h.renderImport(w, nil, apperr.Message(apperr.InvalidInput))
		return
	}
	h.renderImport(w, survey, "")
}

// surveyCSV は列名と行数だけを読む。値そのものは返さない・保存しない。
func surveyCSV(file multipart.File, header *multipart.FileHeader) (*csvSurveyResult, error) {
	reader := csv.NewReader(stripBOM(file))
	reader.FieldsPerRecord = -1

	columns, err := reader.Read()
	if err == io.EOF {
		return &csvSurveyResult{Filename: header.Filename, Columns: []string{}, Rows: 0}, nil
	}
	if err != nil {
		return nil, err
	}

	rows := 0
	for {
		_, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		rows++
	}
	return &csvSurveyResult{Filename: header.Filename, Columns: columns, Rows: rows}, nil
}

// stripBOM はExcelが書き出すUTF-8 BOM付きCSVを、BOM無しとして読めるようにする。
func stripBOM(r io.Reader) io.Reader {
	br := &bomReader{r: r}
	return br
}

type bomReader struct {
	r       io.Reader
	checked bool
}

func (b *bomReader) Read(p []byte) (int, error) {
	if !b.checked {
		b.checked = true
		buf := make([]byte, 3)
		n, err := io.ReadFull(b.r, buf)
		bom := []byte{0xEF, 0xBB, 0xBF}
		if n == 3 && string(buf) == string(bom) {
			return b.r.Read(p)
		}
		// BOM ではなかった分をそのまま返す。3バイト未満で読み切れたのは
		// ファイルがそれだけ短かっただけで、読み取りの失敗ではない。
		if err == io.ErrUnexpectedEOF {
			err = nil
		}
		copy(p, buf[:n])
		return n, err
	}
	return b.r.Read(p)
}

// ---- 25. マスタ -----------------------------------------------------

type masterRow struct {
	Code   string
	Label  string
	Detail string
}

type masterView struct {
	Key        string
	Categories []string
	Rows       []masterRow
}

// Master は GET /settings/master（既定カテゴリ）。
func (h *Handlers) Master(w http.ResponseWriter, r *http.Request) {
	h.renderMaster(w, r, defaultMasterKey)
}

// MasterDetail は GET /settings/master/{key}。
func (h *Handlers) MasterDetail(w http.ResponseWriter, r *http.Request) {
	h.renderMaster(w, r, r.PathValue("key"))
}

func (h *Handlers) renderMaster(w http.ResponseWriter, r *http.Request, key string) {
	items, ok := h.store.MasterItems(key)
	if !ok {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusNotFound)
		fmt.Fprint(w, apperr.Message(apperr.NotFound))
		return
	}
	rows := make([]masterRow, 0, len(items))
	for _, it := range items {
		rows = append(rows, masterRow{Code: it.Code, Label: it.Label, Detail: it.Detail})
	}
	_ = h.views.RenderHTTP(w, http.StatusOK, "settings_master", masterView{
		Key:        key,
		Categories: masterCategories,
		Rows:       rows,
	})
}

// APIMaster は GET /api/masters/{key}。一覧・参照専用（書き込み経路は無い）。
func (h *Handlers) APIMaster(w http.ResponseWriter, r *http.Request) {
	key := r.PathValue("key")
	items, ok := h.store.MasterItems(key)
	if !ok {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}

	limit, offset := parseLimitOffset(r)
	total := len(items)
	if offset > total {
		offset = total
	}
	end := offset + limit
	if end > total {
		end = total
	}
	page := items[offset:end]

	writeJSON(w, http.StatusOK, map[string]any{
		"key":   key,
		"items": page,
		"total": total,
	})
}

func parseLimitOffset(r *http.Request) (limit, offset int) {
	limit = 50
	offset = 0
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 1 && n <= 200 {
			limit = n
		}
	}
	if v := r.URL.Query().Get("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
	}
	return limit, offset
}

// ---- /postal ----------------------------------------------------------

// Postal は GET /postal?code=。
// Postal は GET /postal（郵便番号から住所候補を引く）。
//
// spec/openapi.yaml はこの経路に "200" しか定義していない（`code` は
// required だが、エラー用の4xxレスポンスが契約に無い）。以前は `code` が
// 空のとき422を返していたが、契約どおりに読むなら「候補が見つからない」の
// 一種として常に200で返すのが正しい（`reason` に理由を入れる形は
// 「該当なし」も「codeが無い」も同じ形で表現できる）。
func (h *Handlers) Postal(w http.ResponseWriter, r *http.Request) {
	code := strings.TrimSpace(r.URL.Query().Get("code"))
	if digitsOnly(code) == "" {
		writeJSON(w, http.StatusOK, map[string]any{
			"candidates": []PostalCandidate{},
			"reason":     "郵便番号（code）が指定されていません。",
		})
		return
	}
	candidates, reason := LookupPostal(code)
	var reasonJSON any
	if reason != "" {
		reasonJSON = reason
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"candidates": candidates,
		"reason":     reasonJSON,
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
