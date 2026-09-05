<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Staff extends Model
{
    protected $table = 'staff';

    protected $fillable = ['staff_code', 'name', 'role', 'is_active', 'password_hash'];

    protected $hidden = ['password_hash'];

    protected $casts = ['is_active' => 'boolean'];
}
