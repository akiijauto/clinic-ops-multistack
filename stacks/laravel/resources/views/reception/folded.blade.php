@extends('layouts.app')

@section('title', '折りたたみ表示')

@section('content')
    <div class="card" data-testid="screen-folded">
        <h1>折りたたみ表示 — この企画では扱わない機能</h1>
        <p>
            <code>spec/model.md</code>「落としたもの」に対応する項目です。読むだけで、
            この一覧から機能を戻すことはできません。
        </p>
        @foreach ($items as $key => $item)
            <div class="card" id="folded-{{ $key }}" @if($only && $only !== $key) style="opacity:.5" @endif>
                <h2>{{ $item['title'] }}</h2>
                <p>{{ $item['message'] }}</p>
                @if (!empty($item['seen_at']))
                    <p><small>見える場所: {{ $item['seen_at'] }}</small></p>
                @endif
            </div>
        @endforeach
    </div>
@endsection
