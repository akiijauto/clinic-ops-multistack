package settings

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"
)

// Store はこの領域が読み書きするデータをメモリ上に持つ。
//
// Clinic だけは実際に保存できる（spec/screens.md 22章）。
// それ以外（機能設定・取込・マスタ）は data/ から読み込むだけで、
// 書き込み経路を持たない。
type Store struct {
	mu sync.RWMutex

	clinic Clinic

	priceItems []PriceItem
	labItems   []LabItem
	masters    mastersFile

	// importCounts は data/seed.json のトップレベル配列の件数
	// （種類ごと）。取込画面「読み込み済みの初期データの件数」に使う。
	importCounts map[string]int
	loadedAt     time.Time
}

// seedClinicFile は data/seed.json のうち、この領域が要る部分だけを読む。
// 他領域のフィールド（owners・patients 等）は importCounts で件数だけ数えるので
// 型を持たず json.RawMessage のまま扱う。
type seedClinicFile struct {
	Clinic Clinic `json:"clinic"`
}

// Load は dataDir から seed.json・price_items.json・lab_items.json・masters.json
// を読み込む。
func Load(dataDir string) (*Store, error) {
	var seed seedClinicFile
	if err := readJSON(filepath.Join(dataDir, "seed.json"), &seed); err != nil {
		return nil, err
	}
	counts, err := countSeedArrays(filepath.Join(dataDir, "seed.json"))
	if err != nil {
		return nil, err
	}
	var priceItems []PriceItem
	if err := readJSON(filepath.Join(dataDir, "price_items.json"), &priceItems); err != nil {
		return nil, err
	}
	var labItems []LabItem
	if err := readJSON(filepath.Join(dataDir, "lab_items.json"), &labItems); err != nil {
		return nil, err
	}
	var masters mastersFile
	if err := readJSON(filepath.Join(dataDir, "masters.json"), &masters); err != nil {
		return nil, err
	}

	return &Store{
		clinic:       seed.Clinic,
		priceItems:   priceItems,
		labItems:     labItems,
		masters:      masters,
		importCounts: counts,
		loadedAt:     time.Now(),
	}, nil
}

func readJSON(path string, v any) error {
	f, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("%s を開けない: %w", path, err)
	}
	defer f.Close()
	if err := json.NewDecoder(f).Decode(v); err != nil {
		return fmt.Errorf("%s を読めない: %w", path, err)
	}
	return nil
}

// countSeedArrays は seed.json をトップレベルの key -> 配列長 として数える。
// 他領域の型を import せずに件数だけ得るため、汎用の map で読む。
func countSeedArrays(path string) (map[string]int, error) {
	raw := map[string]json.RawMessage{}
	if err := readJSON(path, &raw); err != nil {
		return nil, err
	}
	counts := make(map[string]int, len(raw))
	for key, v := range raw {
		var arr []json.RawMessage
		if err := json.Unmarshal(v, &arr); err != nil {
			continue // 配列でない項目（"clinic" 等）は件数の対象外
		}
		counts[key] = len(arr)
	}
	return counts, nil
}

// Clinic はいまの病院設定を返す。
func (s *Store) Clinic() Clinic {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.clinic
}

// SaveClinic は病院設定を上書きする。ID は変えない（1件だけ、という制約を
// 保つため、呼び出し側が別の ID を渡しても無視する）。
func (s *Store) SaveClinic(c Clinic) Clinic {
	s.mu.Lock()
	defer s.mu.Unlock()
	c.ID = s.clinic.ID
	s.clinic = c
	return s.clinic
}

// ImportSummary は「取込」画面が表示する1行分。
type ImportSummary struct {
	Kind  string
	Count int
}

// ImportSummaries は種類ごとの件数を、名前の順で返す
// （毎回同じ並びで返すことが「表示のたびに数字が動く」事故を避ける）。
func (s *Store) ImportSummaries() []ImportSummary {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]ImportSummary, 0, len(s.importCounts))
	for k, n := range s.importCounts {
		out = append(out, ImportSummary{Kind: k, Count: n})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Kind < out[j].Kind })
	return out
}

// LoadedAt は初期データを読み込んだ日時。
//
// **仮決めしたこと**: data/ 側にタイムスタンプが無いため、プロセスが
// Store を読み込んだ時刻をそのまま「読み込み日時」とする。
func (s *Store) LoadedAt() time.Time {
	return s.loadedAt
}
