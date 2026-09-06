package reception

import (
	"encoding/json"
	"net/http"
	"strconv"

	"clinicops/internal/apperr"
)

// apiPatient は /api/patients* のJSON表現（PatientWithOwner に対応）。
type apiPatient struct {
	ID         int       `json:"id"`
	KarteNo    string    `json:"karte_no"`
	OwnerID    int       `json:"owner_id"`
	NameKana   string    `json:"name_kana"`
	NameKanji  string    `json:"name_kanji"`
	Species    string    `json:"species"`
	Breed      string    `json:"breed"`
	Sex        string    `json:"sex"`
	BirthDate  *string   `json:"birth_date"`
	NeuterDate *string   `json:"neuter_date"`
	DeletedAt  *string   `json:"deleted_at"`
	Owner      *apiOwner `json:"owner,omitempty"`
}

type apiOwner struct {
	ID         int     `json:"id"`
	OwnerNo    string  `json:"owner_no"`
	NameKana   string  `json:"name_kana"`
	NameKanji  string  `json:"name_kanji"`
	PostalCode string  `json:"postal_code"`
	Address1   string  `json:"address1"`
	Address2   string  `json:"address2"`
	Phone      string  `json:"phone"`
	Mobile     string  `json:"mobile"`
	DeletedAt  *string `json:"deleted_at"`
}

func toAPIPatient(p Patient) apiPatient {
	return apiPatient{
		ID: p.ID, KarteNo: p.KarteNo, OwnerID: p.OwnerID,
		NameKana: p.NameKana, NameKanji: p.NameKanji,
		Species: p.Species, Breed: p.Breed, Sex: p.Sex,
		BirthDate: p.BirthDate, NeuterDate: p.NeuterDate, DeletedAt: p.DeletedAt,
	}
}

func toAPIOwner(o Owner) apiOwner {
	return apiOwner{
		ID: o.ID, OwnerNo: o.OwnerNo, NameKana: o.NameKana, NameKanji: o.NameKanji,
		PostalCode: o.PostalCode, Address1: o.Address1, Address2: o.Address2,
		Phone: o.Phone, Mobile: o.Mobile, DeletedAt: o.DeletedAt,
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// APIListPatients は GET /api/patients（動物の検索・一覧）。
func (h *Handlers) APIListPatients(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	includeDeleted := q.Get("include_deleted") == "true" || q.Get("include_deleted") == "1"
	limit := 50
	if v, err := strconv.Atoi(q.Get("limit")); err == nil && v > 0 {
		limit = v
	}
	offset := 0
	if v, err := strconv.Atoi(q.Get("offset")); err == nil && v >= 0 {
		offset = v
	}
	patients, total := h.store.PatientList(q.Get("q"), includeDeleted, limit, offset)
	items := make([]apiPatient, 0, len(patients))
	for _, p := range patients {
		item := toAPIPatient(p)
		if o, ok := h.store.OwnerByID(p.OwnerID); ok {
			ao := toAPIOwner(o)
			item.Owner = &ao
		}
		items = append(items, item)
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": total})
}

// APIGetPatient は GET /api/patients/{karte_no}（動物の詳細。飼主を含む）。
func (h *Handlers) APIGetPatient(w http.ResponseWriter, r *http.Request) {
	p, ok := h.store.PatientByKarteNo(r.PathValue("karte_no"))
	if !ok {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	item := toAPIPatient(p)
	if o, ok := h.store.OwnerByID(p.OwnerID); ok {
		ao := toAPIOwner(o)
		item.Owner = &ao
	}
	writeJSON(w, http.StatusOK, item)
}

// APIDeletePatient は POST /api/patients/{karte_no}/delete（動物の論理削除）。
func (h *Handlers) APIDeletePatient(w http.ResponseWriter, r *http.Request) {
	p, ok := h.store.DeletePatient(r.PathValue("karte_no"))
	if !ok {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	writeJSON(w, http.StatusOK, toAPIPatient(p))
}

// APIRestorePatient は POST /api/patients/{karte_no}/restore（論理削除の取り消し）。
func (h *Handlers) APIRestorePatient(w http.ResponseWriter, r *http.Request) {
	p, ok := h.store.RestorePatient(r.PathValue("karte_no"))
	if !ok {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	writeJSON(w, http.StatusOK, toAPIPatient(p))
}

// APIGetOwner は GET /api/owners/{owner_no}（飼主の詳細）。
func (h *Handlers) APIGetOwner(w http.ResponseWriter, r *http.Request) {
	o, ok := h.store.OwnerByNo(r.PathValue("owner_no"))
	if !ok {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	writeJSON(w, http.StatusOK, toAPIOwner(o))
}

// APIDeleteOwner は POST /api/owners/{owner_no}/delete（飼主の論理削除）。
func (h *Handlers) APIDeleteOwner(w http.ResponseWriter, r *http.Request) {
	o, ok := h.store.DeleteOwner(r.PathValue("owner_no"))
	if !ok {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	writeJSON(w, http.StatusOK, toAPIOwner(o))
}

// apiReception は /api/receptions* のJSON表現。
type apiReception struct {
	ID             int     `json:"id"`
	PatientID      int     `json:"patient_id"`
	DisplayNo      int     `json:"display_no"`
	ReceivedAt     string  `json:"received_at"`
	OwnerPurpose   *string `json:"owner_purpose"`
	MedicalPurpose *string `json:"medical_purpose"`
	Status         string  `json:"status"`
	StaffID        *int    `json:"staff_id"`
}

func toAPIReception(r Reception) apiReception {
	return apiReception{
		ID: r.ID, PatientID: r.PatientID, DisplayNo: r.DisplayNo, ReceivedAt: r.ReceivedAt,
		OwnerPurpose: r.OwnerPurpose, MedicalPurpose: r.MedicalPurpose,
		Status: r.Status, StaffID: r.StaffID,
	}
}

// APIListReceptions は GET /api/receptions（本日の患者（受付）一覧）。
// `date` 省略時はJSTの本日。`kind` は受付区分（reception_kinds の code）。
func (h *Handlers) APIListReceptions(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	date := q.Get("date")
	if date == "" {
		date = TodayJST()
	}
	kindName := ""
	if code := q.Get("kind"); code != "" {
		for _, k := range h.store.ReceptionKinds() {
			if k.Code == code {
				kindName = k.Name
				break
			}
		}
	}
	rows, _ := h.store.TodayList(date, kindName, false)
	items := make([]apiReception, 0, len(rows))
	for _, row := range rows {
		items = append(items, toAPIReception(row.Reception))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": len(items)})
}
