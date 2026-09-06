<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // この企画は認証を扱わない（coordination/DECISIONS.md 第4節）。
        // 共通テスト（tests/）はCSRFトークンを持たない外部クライアントとして
        // HTMLフォームへ直接POSTするため、CSRF検証を全ルートで無効化する
        // （さもないと全フォーム送信が419になる。ユーザーのログインセッションを
        // 想定していないので、実害となるCSRF脅威モデル自体が無い）。
        $middleware->validateCsrfTokens(except: ['*']);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
