@extends('layouts.app')

@section('title', '予約詳細')

@section('content')
    <div class="card" data-testid="screen-reservations">
        <h1>予約詳細 #{{ $reservation->id }}</h1>

        @if (!empty($error))
            <div data-testid="error-banner" class="error-banner">{{ $error }}</div>
        @endif
        @if (!empty($success))
            <div data-testid="success-banner" class="success-banner">{{ $success }}</div>
        @endif

        <p>患者: {{ $reservation->patient?->name_kanji }} / 状態: {{ $reservation->status }}</p>

        <form method="post" action="/reservations/{{ $reservation->id }}">
            @csrf
            <p><label>開始 <input type="datetime-local" name="starts_at" value="{{ $reservation->starts_at->format('Y-m-d\TH:i') }}"></label></p>
            <p><label>終了 <input type="datetime-local" name="ends_at" value="{{ $reservation->ends_at->format('Y-m-d\TH:i') }}"></label></p>
            <p><label>担当
                <select name="staff_id">
                    @foreach ($staffList as $s)
                        <option value="{{ $s->id }}" @selected($s->id === $reservation->staff_id)>{{ $s->name }}</option>
                    @endforeach
                </select>
            </label></p>
            <p><label>処置室 <input name="room" value="{{ $reservation->room }}"></label></p>
            <p><label>目的 <input name="purpose" value="{{ $reservation->purpose }}"></label></p>
            <button class="button" type="submit">更新</button>
        </form>

        @if ($reservation->status === 'booked')
            <form method="post" action="/reservations/{{ $reservation->id }}/cancel">
                @csrf
                <button class="button secondary" type="submit">キャンセル</button>
            </form>
        @endif
    </div>
@endsection
