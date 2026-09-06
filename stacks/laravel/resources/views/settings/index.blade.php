@extends('layouts.app')

@section('title', '設定')

@section('content')
    <div class="card" data-testid="screen-settings">
        <h1>病院設定</h1>

        @if (!empty($success))
            <div data-testid="success-banner">{{ $success }}</div>
        @endif

        <form method="post" action="/settings">
            @csrf
            <p><label>名称 <input name="name" value="{{ $clinic->name }}"></label></p>
            <p><label>郵便番号 <input name="postal_code" value="{{ $clinic->postal_code }}"></label></p>
            <p><label>住所1 <input name="address1" value="{{ $clinic->address1 }}"></label></p>
            <p><label>住所2 <input name="address2" value="{{ $clinic->address2 }}"></label></p>
            <p><label>電話 <input name="phone" value="{{ $clinic->phone }}"></label></p>
            <p><label>FAX <input name="fax" value="{{ $clinic->fax }}"></label></p>
            <p><label>開設者名 <input name="director_name" value="{{ $clinic->director_name }}"></label></p>
            <p><label>消費税率 <input name="tax_rate" type="number" step="0.01" value="{{ $clinic->tax_rate }}"></label></p>
            <p><label>予約枠(分) <input name="reservation_slot_minutes" type="number" value="{{ $clinic->reservation_slot_minutes }}"></label></p>
            <p>休診日:
                @foreach (['月','火','水','木','金','土','日'] as $i => $label)
                    <label>
                        <input type="checkbox" name="closed_weekdays[]" value="{{ $i }}"
                            @checked(in_array($i, $clinic->closed_weekdays ?? []))>
                        {{ $label }}
                    </label>
                @endforeach
            </p>
            <button class="btn" type="submit">保存</button>
        </form>

        <p>
            <a class="btn secondary" href="/settings/features">機能設定</a>
            <a class="btn secondary" href="/settings/import">取込</a>
            <a class="btn secondary" href="/settings/master">マスタ</a>
        </p>
    </div>
@endsection
