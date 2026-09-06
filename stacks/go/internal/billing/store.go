package billing

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
)

// Store は `data/` から読み込んだ内容をメモリ上に持つ。
//
// 会計の確定・明細の追加等（検算1・2の範囲を超える書き込み）を足したため、
// 複数リクエストからの同時アクセスに備えて mu で守る
// （internal/store が保存先を決めるまでの、プロセス内メモリだけの書き込み）。
type Store struct {
	mu sync.RWMutex

	clinic     Clinic
	priceItems map[string]PriceItem

	ownersByID     map[int]Owner
	patientsByID   map[int]Patient
	patientsByNo   map[string]Patient // karte_no -> Patient
	preventions    []Prevention
	preventionName map[string]string // kind code -> 表示名

	billings        map[int]Billing
	detailsByID     map[int][]BillingDetail // billing_id -> details（row_no順）
	billingOrder    []int                   // 元の並び順を残す（決定的な応答のため）
	billingsByOwner map[int][]int           // owner_id -> billing id（新しい順）

	nextBillingID int
	nextDetailID  int
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

// Load は dataDir から seed.json・price_items.json・masters.json を読み込む。
func Load(dataDir string) (*Store, error) {
	var seed seedFile
	if err := readJSON(filepath.Join(dataDir, "seed.json"), &seed); err != nil {
		return nil, err
	}
	var items []PriceItem
	if err := readJSON(filepath.Join(dataDir, "price_items.json"), &items); err != nil {
		return nil, err
	}
	var masters mastersFile
	if err := readJSON(filepath.Join(dataDir, "masters.json"), &masters); err != nil {
		return nil, err
	}

	s := &Store{
		clinic:     seed.Clinic,
		priceItems: make(map[string]PriceItem, len(items)),

		ownersByID:     make(map[int]Owner, len(seed.Owners)),
		patientsByID:   make(map[int]Patient, len(seed.Patients)),
		patientsByNo:   make(map[string]Patient, len(seed.Patients)),
		preventions:    seed.Preventions,
		preventionName: make(map[string]string, len(masters.PreventionKinds)),

		billings:        make(map[int]Billing, len(seed.Billings)),
		detailsByID:     make(map[int][]BillingDetail),
		billingsByOwner: make(map[int][]int),
	}
	for _, it := range items {
		s.priceItems[it.PriceCode] = it
	}
	for _, o := range seed.Owners {
		s.ownersByID[o.ID] = o
	}
	for _, p := range seed.Patients {
		s.patientsByID[p.ID] = p
		s.patientsByNo[p.KarteNo] = p
	}
	for _, k := range masters.PreventionKinds {
		s.preventionName[k.Code] = k.Name
	}
	for _, b := range seed.Billings {
		s.billings[b.ID] = b
		s.billingOrder = append(s.billingOrder, b.ID)
		if b.ID >= s.nextBillingID {
			s.nextBillingID = b.ID + 1
		}
	}
	for _, d := range seed.BillingDetails {
		s.detailsByID[d.BillingID] = append(s.detailsByID[d.BillingID], d)
		if d.ID >= s.nextDetailID {
			s.nextDetailID = d.ID + 1
		}
	}
	for bid, ds := range s.detailsByID {
		ds := ds
		sort.Slice(ds, func(i, j int) bool { return ds[i].RowNo < ds[j].RowNo })
		s.detailsByID[bid] = ds
	}
	s.rebuildOwnerIndexLocked()
	return s, nil
}

// rebuildOwnerIndexLocked は billingsByOwner を billingOrder から作り直す。
// 呼び出し側で mu を確保していること（Load 時・新規伝票の作成後に呼ぶ）。
func (s *Store) rebuildOwnerIndexLocked() {
	s.billingsByOwner = make(map[int][]int, len(s.billingsByOwner))
	for _, id := range s.billingOrder {
		b := s.billings[id]
		s.billingsByOwner[b.OwnerID] = append(s.billingsByOwner[b.OwnerID], id)
	}
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
