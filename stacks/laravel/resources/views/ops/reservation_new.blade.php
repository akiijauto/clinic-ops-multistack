@extends('layouts.app')

@section('title', '新規予約')

@section('content')
    <div class="card" data-testid="screen-reservations">
        <h1>新規予約</h1>

        @if (!empty($error))
            <div data-testid="error-banner" class="error-banner">{{ $error }}</div>
        @endif

        <form method="post" action="/reservations">
            @csrf
            <p><label>カルテNo <input name="karte_no" value="{{ $patient->karte_no ?? '' }}"></label></p>
            <p><label>開始 <input type="datetime-local" name="starts_at"></label></p>
            <p><label>終了 <input type="datetime-local" name="ends_at"></label></p>
            <p><label>担当
                <select name="staff_id">
                    @foreach ($staffList as $s)
                        <option value="{{ $s->id }}">{{ $s->name }}</option>
                    @endforeach
                </select>
            </label></p>
            <p><label>処置室 <input name="room" placeholder="診察室1"></label></p>
            <p><label>目的 <input name="purpose"></label></p>
            <button class="button" type="submit">予約する</button>
        </form>
    </div>
@endsection
