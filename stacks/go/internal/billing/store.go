package billing

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// Store は `data/` から読み込んだ内容をメモリ上に持つ。
// 契約の完了の判定（spec/README.md）にある「保存の道具は各レーンが選んでよい」
// を踏まえ、書き込みが要らない検算1・2の範囲ではファイルを読むだけで足りる。
type Store struct {
	clinic       Clinic
	priceItems   map[string]PriceItem
	billings     map[int]Billing
	detailsByID  map[int][]BillingDetail // billing_id -> details
	billingOrder []int                   // 元の並び順を残す（決定的な応答のため）
}

// ResolveDataDir は hint（既定 "data"）が指すディレクトリに `seed.json` が
// 無ければ、親をたどって `data/seed.json` を探す。
//
// なぜ要るか: `stacks/go/` の外にある共通の `data/`（凍結対象）を、
// `go run` をどこから起動しても見つけられるようにするため。
// stacks/go 配下に data/ を複製すると、共通データを書き換えたときに
// 2か所を直す事故が起きる。
func ResolveDataDir(hint string) (string, error) {
	if hasSeed(hint) {
		return hint, nil
	}
	dir, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("作業ディレクトリを取得できない: %w", err)
	}
	for i := 0; i < 8; i++ {
		candidate := filepath.Join(dir, "data")
		if hasSeed(candidate) {
			return candidate, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return "", fmt.Errorf("data/seed.json が見つからない（%s から上位をたどって探索した）", hint)
}

func hasSeed(dir string) bool {
	_, err := os.Stat(filepath.Join(dir, "seed.json"))
	return err == nil
}

// Load は dataDir から seed.json と price_items.json を読み込む。
func Load(dataDir string) (*Store, error) {
	var seed seedFile
	if err := readJSON(filepath.Join(dataDir, "seed.json"), &seed); err != nil {
		return nil, err
	}
	var items []PriceItem
	if err := readJSON(filepath.Join(dataDir, "price_items.json"), &items); err != nil {
		return nil, err
	}

	s := &Store{
		clinic:      seed.Clinic,
		priceItems:  make(map[string]PriceItem, len(items)),
		billings:    make(map[int]Billing, len(seed.Billings)),
		detailsByID: make(map[int][]BillingDetail),
	}
	for _, it := range items {
		s.priceItems[it.PriceCode] = it
	}
	for _, b := range seed.Billings {
		s.billings[b.ID] = b
		s.billingOrder = append(s.billingOrder, b.ID)
	}
	for _, d := range seed.BillingDetails {
		s.detailsByID[d.BillingID] = append(s.detailsByID[d.BillingID], d)
	}
	return s, nil
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

// unitPrice は明細の単価を解決する。明細に無ければ料金マスタから引く。
// どちらにも無ければ nil（未設定。0円として扱わない — spec/acceptance.md 検算2）。
func (s *Store) unitPrice(d BillingDetail) *int {
	if d.UnitPrice != nil {
		return d.UnitPrice
	}
	if item, ok := s.priceItems[d.PriceCode]; ok {
		return item.UnitPrice
	}
	return nil
}

// isTaxable は明細の課否判定。明細に持たせているのでそのまま使う
// （契約上 BillingDetail.is_taxable は必須項目）。
func (d BillingDetail) taxable() bool {
	return d.IsTaxable
}

// categoryMajor は明細が属する分類（上位1階層）。料金マスタに項目が無ければ空文字。
func (s *Store) categoryMajor(d BillingDetail) string {
	item, ok := s.priceItems[d.PriceCode]
	if !ok {
		return ""
	}
	return item.categoryMajor()
}
