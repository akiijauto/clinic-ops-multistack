// Package config は、環境変数から実行時の設定を読む。
//
// 設定ライブラリは使わない。net/http だけで書く方針に合わせ、
// os.Getenv と標準ライブラリの変換だけで組み立てる。
package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// JST は集計・表示に使う唯一のタイムゾーン。
// spec/README.md「日付・時刻は JST。集計の月境界も JST」に対応する。
// Windows には tzdata が入っていない場合があるため、
// time.LoadLocation に頼らず固定オフセットで持つ。
var JST = time.FixedZone("JST", 9*60*60)

// Config は実行時設定。
type Config struct {
	// Addr は待ち受けアドレス（例 ":8080"）。
	Addr string
	// DataDir は合成データと保存先を置く場所。
	DataDir string
	// ReadOnly は書き込みを断るかどうか。
	// 題材の評価版が読み取り専用で配備される事情に合わせて口を開けてある。
	ReadOnly bool
	// ShutdownTimeout は停止要求からの猶予。
	ShutdownTimeout time.Duration
}

// Load は環境変数から設定を読む。値が無いときは既定値を使う。
func Load() (Config, error) {
	c := Config{
		Addr:            envStr("CLINICOPS_ADDR", ":8080"),
		DataDir:         envStr("CLINICOPS_DATA_DIR", "data"),
		ShutdownTimeout: 10 * time.Second,
	}

	ro, err := envBool("CLINICOPS_READ_ONLY", false)
	if err != nil {
		return Config{}, err
	}
	c.ReadOnly = ro

	return c, nil
}

func envStr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func envBool(key string, def bool) (bool, error) {
	v := os.Getenv(key)
	if v == "" {
		return def, nil
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return false, fmt.Errorf("環境変数 %s の値 %q を真偽値として読めない: %w", key, v, err)
	}
	return b, nil
}
