package reception

import (
	"net/http"
	"strconv"
	"strings"

	"clinicops/internal/apperr"
	"clinicops/internal/view"
)

// Handlers は「受付・患者」領域の画面・データのルートを受け持つ。
// Server（internal/server）には依存しない。統合担当が
// net/http.ServeMux へこのパッケージのメソッドをそのまま登録できるようにするため。
type Handlers struct {
	store *Store
	views *view.Set
}

// New は dataDir から Store を組み立てる。
func New(dataDir string, views *view.Set) (*Handlers, error) {
	store, err := Load(dataDir)
	if err != nil {
		return nil, err
	}
	return &Handlers{store: store, views: views}, nil
}

// ---- 1. 本日の患者 ----

type todayKindView struct {
	Code   string
	Name   string
	Active bool
}

type todayRowView struct {
	ID             int
	DisplayNo      int
	KarteNo        string
	OwnerName      string
	Species        string
	Breed          string
	PatientName    string
	ReceivedAt     string
	OwnerPurpose   string
	MedicalPurpose string
	Status         string
	StaffName      string
}

type todayViewData struct {
	Kinds           []todayKindView
	SelectedKind    string
	Rows            []todayRowView
	HasSelection    bool
	HideDone        bool
	DoneCount       int
	VisitCountToday int
	ErrorMessage    string
}

// Today は「本日の患者」一覧（GET /today）。
func (h *Handlers) Today(w http.ResponseWriter, r *http.Request) {
	kinds := h.store.ReceptionKinds()
	selected := r.URL.Query().Get("kind")
	if selected == "" && len(kinds) > 0 {
		selected = kinds[0].Code
	}
	found := false
	kindName := ""
	kv := make([]todayKindView, 0, len(kinds))
	for _, k := range kinds {
		active := k.Code == selected
		if active {
			found = true
			kindName = k.Name
		}
		kv = append(kv, todayKindView{Code: k.Code, Name: k.Name, Active: active})
	}
	if !found && len(kinds) > 0 {
		// マスタに無い区分が来たら1つ目へ戻す（spec/openapi.yaml /today の説明）。
		selected = kinds[0].Code
		kindName = kinds[0].Name
		for i := range kv {
			kv[i].Active = kv[i].Code == selected
		}
	}

	hideDone := r.URL.Query().Get("hide") == "1"
	date := TodayJST()
	rows, doneCount := h.store.TodayList(date, kindName, hideDone)

	out := make([]todayRowView, 0, len(rows))
	for _, row := range rows {
		out = append(out, todayRowView{
			ID:             row.Reception.ID,
			DisplayNo:      row.Reception.DisplayNo,
			KarteNo:        row.Patient.KarteNo,
			OwnerName:      row.Owner.NameKanji,
			Species:        row.Patient.Species,
			Breed:          row.Patient.Breed,
			PatientName:    row.Patient.NameKanji,
			ReceivedAt:     row.Reception.ReceivedAt,
			OwnerPurpose:   deref(row.Reception.OwnerPurpose),
			MedicalPurpose: deref(row.Reception.MedicalPurpose),
			Status:         row.Reception.Status,
			StaffName:      row.StaffName,
		})
	}

	data := todayViewData{
		Kinds:           kv,
		SelectedKind:    selected,
		Rows:            out,
		HideDone:        hideDone,
		DoneCount:       doneCount,
		VisitCountToday: h.store.VisitCountOn(date),
	}
	_ = h.views.RenderHTTP(w, http.StatusOK, "today", data)
}

// TodayMove は「本日の患者」の上へ／下へ（画面内フォームからのPOST）。
// 契約（spec/openapi.yaml）には無い、画面内だけで完結する追加の経路。
// 統合担当への報告事項: POST /today?id=<id>&dir=up|down&kind=<code>&hide=<0|1>
func (h *Handlers) TodayMove(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err == nil {
		id, _ := strconv.Atoi(r.FormValue("id"))
		dir := r.FormValue("dir")
		if id > 0 {
			h.store.MoveReception(id, dir)
		}
	}
	q := r.URL.Query()
	redirect := "/today"
	if kind := q.Get("kind"); kind != "" {
		redirect += "?kind=" + kind
		if q.Get("hide") == "1" {
			redirect += "&hide=1"
		}
	} else if q.Get("hide") == "1" {
		redirect += "?hide=1"
	}
	http.Redirect(w, r, redirect, http.StatusSeeOther)
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// ---- 2. 新規登録 ----

type newAnimalViewData struct {
	NextKarteNo     string
	ExistingOwnerNo string
	ExistingOwner   *Owner
	Form            NewOwnerAndPatientInput
	ErrorMessage    string
	SuccessKarteNo  string
}

// NewPatientForm は新規登録画面（GET /animals/new）。
func (h *Handlers) NewPatientForm(w http.ResponseWriter, r *http.Request) {
	data := newAnimalViewData{NextKarteNo: h.store.NextKarteNo()}
	if ownerNo := r.URL.Query().Get("owner"); ownerNo != "" {
		data.ExistingOwnerNo = ownerNo
		if o, ok := h.store.OwnerByNo(ownerNo); ok {
			data.ExistingOwner = &o
		} else {
			data.ErrorMessage = apperr.Message(apperr.NotFound)
		}
	}
	_ = h.views.RenderHTTP(w, http.StatusOK, "new_animal", data)
}

// CreatePatient は新規登録の保存（POST /animals/new）。
// 保存の成否によらず200を返し、失敗時は入力値ごとフォームを再描画する
// （spec/openapi.yaml「HTMLフォーム送信時のエラーの出し方」）。
func (h *Handlers) CreatePatient(w http.ResponseWriter, r *http.Request) {
	_ = r.ParseForm()
	ownerNo := r.URL.Query().Get("owner")
	in := NewOwnerAndPatientInput{
		ExistingOwnerNo:  ownerNo,
		OwnerNameKana:    r.FormValue("owner_name_kana"),
		OwnerNameKanji:   r.FormValue("owner_name_kanji"),
		OwnerPostal:      r.FormValue("owner_postal_code"),
		OwnerAddress1:    r.FormValue("owner_address1"),
		OwnerAddress2:    r.FormValue("owner_address2"),
		OwnerPhone:       r.FormValue("owner_phone"),
		OwnerMobile:      r.FormValue("owner_mobile"),
		PatientNameKana:  r.FormValue("patient_name_kana"),
		PatientNameKanji: r.FormValue("patient_name_kanji"),
		Species:          r.FormValue("species"),
		Breed:            r.FormValue("breed"),
		Sex:              r.FormValue("sex"),
		BirthDate:        r.FormValue("birth_date"),
		NeuterDate:       r.FormValue("neuter_date"),
	}
	data := newAnimalViewData{NextKarteNo: h.store.NextKarteNo(), ExistingOwnerNo: ownerNo, Form: in}
	if ownerNo != "" {
		if o, ok := h.store.OwnerByNo(ownerNo); ok {
			data.ExistingOwner = &o
		}
	}

	p, verr := h.store.CreateOwnerAndPatient(in)
	if verr != nil {
		data.ErrorMessage = verr.Message
		_ = h.views.RenderHTTP(w, http.StatusOK, "new_animal", data)
		return
	}
	data.SuccessKarteNo = p.KarteNo
	data.NextKarteNo = h.store.NextKarteNo()
	_ = h.views.RenderHTTP(w, http.StatusOK, "new_animal", data)
}

// ---- 3. 顧客 ----

type animalDetailViewData struct {
	Patient        Patient
	Owner          Owner
	Siblings       []Patient
	ErrorMessage   string
	SuccessMessage string
	View           string // "" | "id_card" | "document" | "breeds"
	BreedHints     []string
}

var breedHints = map[string][]string{
	"dog": {"柴犬", "トイプードル", "チワワ", "ミニチュアダックスフンド", "フレンチブルドッグ", "ポメラニアン", "ミックス"},
	"cat": {"ノルウェージャンフォレストキャット", "アメリカンショートヘア", "スコティッシュフォールド", "ミックス"},
}

// Owner は顧客画面（GET /animals/{karte_no}）。
// ハンドラ名は依頼元の指定に合わせてあるが、実際に組み立てるのは
// Owner（飼主）と Patient（動物）両方を出す「顧客」画面。
func (h *Handlers) Owner(w http.ResponseWriter, r *http.Request) {
	karteNo := r.PathValue("karte_no")
	p, ok := h.store.PatientByKarteNo(karteNo)
	if !ok {
		http.NotFound(w, r)
		return
	}
	o, _ := h.store.OwnerByID(p.OwnerID)
	data := animalDetailViewData{
		Patient:  p,
		Owner:    o,
		Siblings: h.store.PatientsByOwnerID(o.ID),
		View:     r.URL.Query().Get("view"),
	}
	if data.View == "breeds" {
		data.BreedHints = breedHints[p.Species]
	}
	_ = h.views.RenderHTTP(w, http.StatusOK, "animal_detail", data)
}

// OwnerSave は顧客画面の保存・番号変更
// （契約の GET のみの /animals/{karte_no} に対する、画面内だけで完結する追加の POST 経路）。
func (h *Handlers) OwnerSave(w http.ResponseWriter, r *http.Request) {
	karteNo := r.PathValue("karte_no")
	p, ok := h.store.PatientByKarteNo(karteNo)
	if !ok {
		http.NotFound(w, r)
		return
	}
	_ = r.ParseForm()
	action := r.FormValue("action")
	data := animalDetailViewData{}

	switch action {
	case "renumber_patient":
		newKarte := strings.TrimSpace(r.FormValue("new_karte_no"))
		np, verr := h.store.RenumberPatient(karteNo, newKarte)
		if verr != nil {
			p2, _ := h.store.PatientByKarteNo(karteNo)
			o2, _ := h.store.OwnerByID(p2.OwnerID)
			data.Patient, data.Owner = p2, o2
			data.ErrorMessage = verr.Message
			_ = h.views.RenderHTTP(w, http.StatusOK, "animal_detail", data)
			return
		}
		http.Redirect(w, r, "/animals/"+np.KarteNo, http.StatusSeeOther)
		return
	case "renumber_owner":
		o, _ := h.store.OwnerByID(p.OwnerID)
		newOwnerNo := strings.TrimSpace(r.FormValue("new_owner_no"))
		_, verr := h.store.RenumberOwner(o.OwnerNo, newOwnerNo)
		if verr != nil {
			p2, _ := h.store.PatientByKarteNo(karteNo)
			o2, _ := h.store.OwnerByID(p2.OwnerID)
			data.Patient, data.Owner = p2, o2
			data.ErrorMessage = verr.Message
			_ = h.views.RenderHTTP(w, http.StatusOK, "animal_detail", data)
			return
		}
		http.Redirect(w, r, "/animals/"+karteNo, http.StatusSeeOther)
		return
	default: // "save"
		np, _ := h.store.UpdatePatientFields(karteNo,
			r.FormValue("patient_name_kana"), r.FormValue("patient_name_kanji"),
			r.FormValue("species"), r.FormValue("breed"), r.FormValue("sex"),
			r.FormValue("birth_date"), r.FormValue("neuter_date"))
		o, _ := h.store.OwnerByID(np.OwnerID)
		no, _ := h.store.UpdateOwnerFields(o.OwnerNo,
			r.FormValue("owner_name_kana"), r.FormValue("owner_name_kanji"),
			r.FormValue("owner_postal_code"), r.FormValue("owner_address1"), r.FormValue("owner_address2"),
			r.FormValue("owner_phone"), r.FormValue("owner_mobile"))
		data.Patient, data.Owner = np, no
		data.Siblings = h.store.PatientsByOwnerID(no.ID)
		data.SuccessMessage = "保存しました。"
		_ = h.views.RenderHTTP(w, http.StatusOK, "animal_detail", data)
	}
}

// ---- 4. 検索 ----

type searchViewData struct {
	Query       string
	PatientRows []PatientWithOwner
	VisitRows   []VisitHit
	HasSearched bool
}

// Search は検索画面（GET /search）。
func (h *Handlers) Search(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	data := searchViewData{Query: q, HasSearched: q != ""}
	if q != "" {
		data.PatientRows = h.store.SearchOwnersAndPatients(q, false)
		data.VisitRows = h.store.SearchVisits(q, false)
	}
	_ = h.views.RenderHTTP(w, http.StatusOK, "search", data)
}

// ---- 5. 来院履歴 ----

type historyRowView struct {
	Visit     Visit
	IsDeleted bool
}

type historyViewData struct {
	Patient Patient
	Owner   Owner
	Rows    []historyRowView
}

// History は来院履歴画面（GET /animals/{karte_no}/history）。
//
// 仮決め: spec/model.md で AuditLog（監査ログ）が意図して落とされているため、
// 「登録／修正／削除／復元」ごとの変更前後の値は保持していない。
// この実装では Visit 一覧（削除済みを含む・新しい順）を「操作」＝
// 削除済みなら「削除」・そうでなければ「登録」として簡略化して出す。
// 「元に戻す」の実行自体は診療領域（/animals/{karte_no}/karte/{visit_id}/restore）
// が持つため、ここではそのURLへのリンクを出すだけに留める。
func (h *Handlers) History(w http.ResponseWriter, r *http.Request) {
	karteNo := r.PathValue("karte_no")
	p, ok := h.store.PatientByKarteNo(karteNo)
	if !ok {
		http.NotFound(w, r)
		return
	}
	o, _ := h.store.OwnerByID(p.OwnerID)
	visits := h.store.HistoryVisits(p.ID)
	rows := make([]historyRowView, 0, len(visits))
	for _, v := range visits {
		rows = append(rows, historyRowView{Visit: v, IsDeleted: v.DeletedAt != nil})
	}
	_ = h.views.RenderHTTP(w, http.StatusOK, "history", historyViewData{Patient: p, Owner: o, Rows: rows})
}

// ---- 6. 削除（動物・飼主の論理削除確認） ----

type deleteConfirmViewData struct {
	Patient        Patient
	Owner          Owner
	AlreadyDeleted bool
	ErrorMessage   string
	SuccessMessage string
}

// DeleteConfirm は削除の確認画面（GET）と実行（POST）。
// spec/openapi.yaml screen_delete_animal_confirm / screen_delete_animal に対応する
// （画面3「顧客」の飼主削除・動物削除の実行先）。
func (h *Handlers) DeleteConfirm(w http.ResponseWriter, r *http.Request) {
	karteNo := r.PathValue("karte_no")
	p, ok := h.store.PatientByKarteNo(karteNo)
	if !ok {
		http.NotFound(w, r)
		return
	}
	o, _ := h.store.OwnerByID(p.OwnerID)
	data := deleteConfirmViewData{Patient: p, Owner: o, AlreadyDeleted: p.DeletedAt != nil}

	if r.Method == http.MethodPost {
		np, ok := h.store.DeletePatient(karteNo)
		if !ok {
			http.NotFound(w, r)
			return
		}
		data.Patient = np
		data.AlreadyDeleted = true
		no, _ := h.store.OwnerByID(np.OwnerID)
		data.Owner = no
		data.SuccessMessage = "削除しました（一覧からは隠れます。データは残ります）。"
	}
	_ = h.views.RenderHTTP(w, http.StatusOK, "delete_confirm", data)
}

// ---- 7. 折りたたみ表示 ----

type foldedViewData struct {
	Items      []FoldedItem
	FocusedKey string
}

// Folded は折りたたみ表示画面（GET /folded/{key}）。
// 一覧そのものは常に全件出す（spec/screens.md「1か所にまとめて見せる」）。
// key はどの項目にスクロールするかのヒント（同「1件だけ見せるか、その項目に
// スクロールするかは自由」）だが、契約上 未知の key は404
// （spec/openapi.yaml /folded/{key}「未知の key は404」）。
func (h *Handlers) Folded(w http.ResponseWriter, r *http.Request) {
	key := r.PathValue("key")
	items := FoldedItems()
	known := false
	for _, it := range items {
		if it.Key == key {
			known = true
			break
		}
	}
	if !known {
		http.NotFound(w, r)
		return
	}
	_ = h.views.RenderHTTP(w, http.StatusOK, "folded", foldedViewData{Items: items, FocusedKey: key})
}

// ---- 統合担当（internal/server）から使う小さな窓口 ----
//
// internal/server の「スタッフ」画面（領域4）が Staff を必要とするが、
// 領域どうしで直接依存を作らない方針（各領域は自分の担当分だけ data/ を読む）
// に沿い、Store を直接公開せず、この2メソッドだけを通す。

// AllStaff はスタッフの全件を返す。
func (h *Handlers) AllStaff() []Staff { return h.store.AllStaff() }

// StaffByID はIDでスタッフ1件を引く。
func (h *Handlers) StaffByID(id int) (Staff, bool) { return h.store.StaffByID(id) }

// VisitCountToday は本日（JST）の診察件数（削除済みも含む実績）。
// トップ・本日の患者の両画面に `data-check="visit_count.today"` として出す
// （spec/acceptance.md 共通の確認手段 表）。
func (h *Handlers) VisitCountToday() int { return h.store.VisitCountOn(TodayJST()) }
