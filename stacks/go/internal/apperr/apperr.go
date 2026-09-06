// Package apperr は spec/openapi.yaml「エラーの文言（一字一句、これを使う）」を
// コードへ落としたもの。
//
// 5実装（このスタックの中でも5領域）で文言を独自に作らないよう、
// 文言はここ1か所だけに置く。データのルート（JSON）はこのまま Write すればよい。
// 画面のルート（HTML）は 200 のまま Message(code) を error-banner に出す
// （契約「HTMLフォーム送信時のエラーの出し方」——ステータスコードを使わない）。
package apperr

import (
	"encoding/json"
	"net/http"
)

// Code は spec/openapi.yaml の Error スキーマの enum と一致する。
type Code string

const (
	InvalidJSON         Code = "invalid_json"
	InvalidInput        Code = "invalid_input"
	NotFound            Code = "not_found"
	Forbidden           Code = "forbidden"
	SaveFailed          Code = "save_failed"
	ReservationConflict Code = "reservation_conflict"
)

var status = map[Code]int{
	InvalidJSON:         http.StatusBadRequest,
	InvalidInput:        http.StatusUnprocessableEntity,
	NotFound:            http.StatusNotFound,
	Forbidden:           http.StatusForbidden,
	SaveFailed:          http.StatusInternalServerError,
	ReservationConflict: http.StatusConflict,
}

// message は契約の表にある文言そのもの（一字一句）。
var message = map[Code]string{
	InvalidJSON:         "リクエストの本文がJSONとして壊れています。書き方を確認してください。",
	InvalidInput:        "入力の形式が正しくありません。必須の項目や値の型を確認してください。",
	NotFound:            "指定されたデータが見つかりません。",
	Forbidden:           "この操作を行う権限がありません。",
	SaveFailed:          "保存に失敗しました。時間をおいてもう一度お試しください。",
	ReservationConflict: "指定した時間帯は、担当または処置室の予定と重なっています。",
}

// Detail はフィールド単位の指摘（422 のときだけ使う。契約は「最低1件」を求める）。
type Detail struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// Error は spec/openapi.yaml の Error スキーマに対応する。
type Error struct {
	Code    Code     `json:"code"`
	Message string   `json:"message"`
	Details []Detail `json:"details,omitempty"`
}

func (e *Error) Error() string { return string(e.Code) + ": " + e.Message }

// Status はこのエラーに対応する HTTP ステータス。
func (e *Error) Status() int {
	if s, ok := status[e.Code]; ok {
		return s
	}
	return http.StatusInternalServerError
}

// New は固定文言を使ってエラーを作る。文言を書き直さないための唯一の入口。
func New(code Code) *Error {
	return &Error{Code: code, Message: message[code]}
}

// WithDetails は 422 invalid_input にフィールド単位の指摘を添える。
func (e *Error) WithDetails(details ...Detail) *Error {
	if len(details) == 0 {
		return e
	}
	clone := *e
	clone.Details = details
	return &clone
}

type envelope struct {
	Error *Error `json:"error"`
}

// Write はデータのルート（JSON）向けに、ステータスコードと本文を書く。
func Write(w http.ResponseWriter, err *Error) {
	b, marshalErr := json.Marshal(envelope{Error: err})
	if marshalErr != nil {
		err = New(SaveFailed)
		b, _ = json.Marshal(envelope{Error: err})
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(err.Status())
	_, _ = w.Write(b)
}

// Message は画面（HTML）ルートが error-banner に出す文言を得るための入口。
// データのルートと文言を1か所（message 変数）で共有する。
func Message(code Code) string { return message[code] }
