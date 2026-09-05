<?php

namespace App\Providers;

use Illuminate\Foundation\Console\ServeCommand;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->allowServeToSeeOurPhpIni();
    }

    /**
     * `php artisan serve` の子プロセスへ PHPRC を通す。
     *
     * この環境の php.ini では pdo_sqlite / sqlite3 / zip が無効なので、
     * このスタック専用の php.ini を PHPRC で読ませている（tools/setup.ps1）。
     *
     * ところが ServeCommand は「渡してよい環境変数」を白名簿で持っていて、
     * PHPRC はそこに無い。無い変数は Symfony Process へ false として渡され、
     * **子プロセスから消される**。結果、php artisan serve だけが
     * 「could not find driver」で 500 を返す（2026-09-05 実測）。
     *
     * artisan test は同じプロセス内で動くので緑のままになる。
     * つまり**テストが緑でも画面が落ちる**形になるので、ここで塞いでおく。
     */
    private function allowServeToSeeOurPhpIni(): void
    {
        if (! class_exists(ServeCommand::class)) {
            return;
        }

        if (! in_array('PHPRC', ServeCommand::$passthroughVariables, true)) {
            ServeCommand::$passthroughVariables[] = 'PHPRC';
        }
    }
}
