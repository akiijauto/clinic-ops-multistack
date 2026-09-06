// Package datadir は、共通データ（トップレベルの data/。凍結対象）の
// 置き場所を探す。
//
// stacks/go 配下にデータを複製すると、共通データを直したときに
// 2か所を直す事故が起きるので、複製せず親をたどって見つける。
// internal/billing・internal/clinical が個別に持っていたのと同じ考え方を
// 1か所へまとめ、以後のドメインパッケージが重複させないためのもの。
package datadir

import (
	"fmt"
	"os"
	"path/filepath"
)

// Resolve は hint（既定 "data"）が指すディレクトリに marker という名前の
// ファイルが無ければ、作業ディレクトリから親をたどって `data/<marker>` を探す。
// 見つかったディレクトリのパスを返す。
func Resolve(hint, marker string) (string, error) {
	if hasFile(hint, marker) {
		return hint, nil
	}
	dir, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("作業ディレクトリを取得できない: %w", err)
	}
	for i := 0; i < 8; i++ {
		candidate := filepath.Join(dir, "data")
		if hasFile(candidate, marker) {
			return candidate, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return "", fmt.Errorf("data/%s が見つからない（%s から8階層たどった）", marker, hint)
}

func hasFile(dir, marker string) bool {
	_, err := os.Stat(filepath.Join(dir, marker))
	return err == nil
}
