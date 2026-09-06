package reception

import (
	"encoding/json"
	"net/http"
	"strconv"

	"clinicops/internal/apperr"
)

// この節は api.go に続く、残りのJSON API（受付の作成・更新、動物・飼主のPATCH、
// スタッフ一覧）を持つ。

// APICreateReception は POST /api/receptions（受付登録）。
func (h *Handlers) APICreateReception(w http.ResponseWriter, r *http.Request) {
	var in apiReception
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		apperr.Write(w, apperr.New(apperr.InvalidJSON))
		return
	}
	created, aerr := h.store.CreateReception(fromAPIReception(in))
	if aerr != nil {
		apperr.Write(w, aerr)
		return
	}
	writeJSON(w, http.StatusCreated, toAPIReception(created))
}

// APICreatePatientReception は POST /api/patients/{karte_no}/receptions
// （この動物を本日の受付に登録）。
func (h *Handlers) APICreatePatientReception(w http.ResponseWriter, r *http.Request) {
	p, ok := h.store.PatientByKarteNo(r.PathValue("karte_no"))
	if !ok {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	var in apiReception
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		apperr.Write(w, apperr.New(apperr.InvalidJSON))
		return
	}
	rec := fromAPIReception(in)
	rec.PatientID = p.ID
	created, aerr := h.store.CreateReception(rec)
	if aerr != nil {
		apperr.Write(w, aerr)
		return
	}
	writeJSON(w, http.StatusCreated, toAPIReception(created))
}

func fromAPIReception(in apiReception) Reception {
	return Reception{
		PatientID: in.PatientID, DisplayNo: in.DisplayNo, ReceivedAt: in.ReceivedAt,
		OwnerPurpose: in.OwnerPurpose, MedicalPurpose: in.MedicalPurpose,
		Status: in.Status, StaffID: in.StaffID,
	}
}

// APIGetReception は GET /api/receptions/{id}。
func (h *Handlers) APIGetReception(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	rec, ok := h.store.ReceptionByID(id)
	if !ok {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	writeJSON(w, http.StatusOK, toAPIReception(rec))
}

// APIUpdateReception は PATCH /api/receptions/{id}（状態・表示順・担当。上下送り含む）。
func (h *Handlers) APIUpdateReception(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	var in apiReception
	if decErr := json.NewDecoder(r.Body).Decode(&in); decErr != nil {
		apperr.Write(w, apperr.New(apperr.InvalidJSON))
		return
	}
	updated, aerr := h.store.UpdateReception(id, fromAPIReception(in))
	if aerr != nil {
		apperr.Write(w, aerr)
		return
	}
	writeJSON(w, http.StatusOK, toAPIReception(updated))
}

// APIPatchPatient は PATCH /api/patients/{karte_no}（動物の更新）。
func (h *Handlers) APIPatchPatient(w http.ResponseWriter, r *http.Request) {
	var in apiPatient
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		apperr.Write(w, apperr.New(apperr.InvalidJSON))
		return
	}
	updated, aerr := h.store.PatchPatient(r.PathValue("karte_no"), fromAPIPatient(in))
	if aerr != nil {
		apperr.Write(w, aerr)
		return
	}
	item := toAPIPatient(updated)
	if o, ok := h.store.OwnerByID(updated.OwnerID); ok {
		ao := toAPIOwner(o)
		item.Owner = &ao
	}
	writeJSON(w, http.StatusOK, item)
}

func fromAPIPatient(in apiPatient) Patient {
	return Patient{
		NameKana: in.NameKana, NameKanji: in.NameKanji, Species: in.Species,
		Breed: in.Breed, Sex: in.Sex, BirthDate: in.BirthDate, NeuterDate: in.NeuterDate,
	}
}

// APIPatchOwner は PATCH /api/owners/{owner_no}（飼主の更新）。
func (h *Handlers) APIPatchOwner(w http.ResponseWriter, r *http.Request) {
	var in apiOwner
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		apperr.Write(w, apperr.New(apperr.InvalidJSON))
		return
	}
	updated, aerr := h.store.PatchOwner(r.PathValue("owner_no"), fromAPIOwner(in))
	if aerr != nil {
		apperr.Write(w, aerr)
		return
	}
	writeJSON(w, http.StatusOK, toAPIOwner(updated))
}

func fromAPIOwner(in apiOwner) Owner {
	return Owner{
		NameKana: in.NameKana, NameKanji: in.NameKanji, PostalCode: in.PostalCode,
		Address1: in.Address1, Address2: in.Address2, Phone: in.Phone, Mobile: in.Mobile,
	}
}

// apiStaff は /api/staff のJSON表現。
type apiStaff struct {
	ID        int    `json:"id"`
	StaffCode string `json:"staff_code"`
	Name      string `json:"name"`
	Role      string `json:"role"`
	IsActive  bool   `json:"is_active"`
}

// APIListStaff は GET /api/staff。
func (h *Handlers) APIListStaff(w http.ResponseWriter, r *http.Request) {
	all := h.store.AllStaff()
	items := make([]apiStaff, 0, len(all))
	for _, st := range all {
		items = append(items, apiStaff{ID: st.ID, StaffCode: st.StaffCode, Name: st.Name, Role: st.Role, IsActive: st.IsActive})
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": len(items)})
}
