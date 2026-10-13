package com.gaiaonline.games.gPinball
{
   public class vector2d
   {
      
      private var __x:Number;
      
      private var __y:Number;
      
      public function vector2d(... rest)
      {
         super();
         __x = rest[0];
         __y = rest[1];
      }
      
      public function dot_product(param1:vector2d) : Number
      {
         return __x * param1.x + __y * param1.y;
      }
      
      public function negate() : void
      {
         __x = -__x;
         __y = -__y;
      }
      
      public function addition(... rest) : void
      {
         var _loc2_:int = 0;
         if(rest.length == 1)
         {
            __x += rest[0].x;
            __y += rest[0].y;
            return;
         }
         if(rest.length == 2)
         {
            __x = rest[0].x + rest[1].x;
            __y = rest[0].y + rest[1].y;
            return;
         }
         if(rest.length > 2)
         {
            __x = rest[0].x;
            __y = rest[0].y;
            _loc2_ = 1;
            while(_loc2_ < rest.length)
            {
               __x += rest[_loc2_].x;
               __y += rest[_loc2_].y;
               _loc2_++;
            }
         }
      }
      
      public function angle_sine(param1:vector2d) : Number
      {
         var _loc2_:Number = NaN;
         _loc2_ = this.cross_product(param1);
         return _loc2_ / (this.norm() * param1.norm());
      }
      
      public function greater(param1:vector2d) : Boolean
      {
         return sigDigits(__x) > sigDigits(param1.x) && sigDigits(__y) > sigDigits(param1.y);
      }
      
      public function set y(param1:Number) : void
      {
         __y = param1;
      }
      
      public function duplicate() : vector2d
      {
         var _loc1_:vector2d = null;
         return new vector2d(__x,__y);
      }
      
      public function less_equal(param1:vector2d) : Boolean
      {
         return sigDigits(__x) <= sigDigits(param1.x) && sigDigits(__y) <= sigDigits(param1.y);
      }
      
      public function area_para(param1:vector2d) : Number
      {
         return this.cross_product(param1);
      }
      
      public function swap(param1:vector2d) : void
      {
         var _loc2_:vector2d = null;
         var _loc3_:vector2d = null;
         var _loc4_:Number = NaN;
         var _loc5_:Number = NaN;
         _loc2_ = param1;
         _loc3_ = this;
         _loc4_ = _loc3_.x;
         _loc5_ = _loc3_.y;
         _loc3_.x = _loc2_.x;
         _loc3_.y = _loc2_.y;
         _loc2_.x = _loc4_;
         _loc2_.y = _loc5_;
      }
      
      public function subtract(... rest) : void
      {
         var _loc2_:int = 0;
         if(rest.length == 1)
         {
            __x -= rest[0].x;
            __y -= rest[0].y;
            return;
         }
         if(rest.length == 2)
         {
            __x = rest[0].x - rest[1].x;
            __y = rest[0].y - rest[1].y;
            return;
         }
         if(rest.length > 2)
         {
            __x = rest[0].x;
            __y = rest[0].y;
            _loc2_ = 1;
            while(_loc2_ < rest.length)
            {
               __x -= rest[_loc2_].x;
               __y -= rest[_loc2_].y;
               _loc2_++;
            }
         }
      }
      
      public function reset(param1:Number, param2:Number) : void
      {
         __x = param1;
         __y = param2;
      }
      
      public function sigDigits(param1:Number) : Number
      {
         return NumberTools.sigDigits(param1,3);
      }
      
      public function rotate(param1:Number, param2:Number) : void
      {
         var _loc3_:Number = NaN;
         var _loc4_:Number = NaN;
         _loc3_ = __x * param2 - __y * param1;
         _loc4_ = __x * param1 + __y * param2;
         __x = _loc3_;
         __y = _loc4_;
      }
      
      public function clone() : vector2d
      {
         var _loc1_:vector2d = null;
         return new vector2d(__x,__y);
      }
      
      public function unit_vector(... rest) : void
      {
         var _loc2_:Number = NaN;
         if(rest.length == 0)
         {
            _loc2_ = 1 / norm();
            __x *= _loc2_;
            __y *= _loc2_;
            return;
         }
         if(rest.length == 1)
         {
            _loc2_ = 1 / rest[0].norm();
            __x = rest[0].x * _loc2_;
            __y = rest[0].y * _loc2_;
         }
      }
      
      public function project(param1:vector2d, param2:vector2d) : void
      {
         var _loc3_:Number = NaN;
         var _loc4_:Number = NaN;
         _loc4_ = param2.norm();
         _loc3_ = param1.dot_product(param2) / (_loc4_ * _loc4_);
         __x = param2.x * _loc3_;
         __y = param2.y * _loc3_;
      }
      
      public function multiply(... rest) : void
      {
         if(rest.length == 1)
         {
            __x *= rest[0].x;
            __y *= rest[0].y;
            return;
         }
         if(rest.length == 2)
         {
            __x = rest[0].x * rest[1].x;
            __y = rest[0].y * rest[1].y;
         }
      }
      
      public function angle_cosine(param1:vector2d) : Number
      {
         return this.dot_product(param1) / (this.norm() * param1.norm());
      }
      
      public function get length() : Number
      {
         return Math.sqrt(__x * __x + __y * __y);
      }
      
      public function less(param1:vector2d) : Boolean
      {
         return sigDigits(__x) < sigDigits(param1.x) && sigDigits(__y) < sigDigits(param1.y);
      }
      
      public function perpendicular(param1:vector2d) : void
      {
         __x = -param1.y;
         __y = param1.x;
      }
      
      public function scalar(param1:Number) : void
      {
         __x *= param1;
         __y *= param1;
      }
      
      public function same_direction(param1:vector2d) : Boolean
      {
         var _loc2_:vector2d = null;
         var _loc3_:vector2d = null;
         _loc2_ = new vector2d();
         _loc3_ = new vector2d();
         _loc2_.unit_vector(this);
         _loc3_.unit_vector(param1);
         return _loc2_.equal(_loc3_);
      }
      
      public function greater_equal(param1:vector2d) : Boolean
      {
         return sigDigits(__x) >= sigDigits(param1.x) && sigDigits(__y) >= sigDigits(param1.y);
      }
      
      public function equal(param1:vector2d) : Boolean
      {
         return sigDigits(__x) == sigDigits(param1.x) && sigDigits(__y) == sigDigits(param1.y);
      }
      
      public function copy(param1:vector2d) : void
      {
         __x = param1.x;
         __y = param1.y;
      }
      
      public function set x(param1:Number) : void
      {
         __x = param1;
      }
      
      public function get x() : Number
      {
         return __x;
      }
      
      public function get y() : Number
      {
         return __y;
      }
      
      public function area_triangle(param1:vector2d, param2:vector2d) : Number
      {
         var _loc3_:vector2d = null;
         var _loc4_:vector2d = null;
         _loc3_ = new vector2d();
         _loc4_ = new vector2d();
         _loc3_.subtract(param1,this);
         _loc4_.subtract(param2,this);
         return 0.5 * _loc3_.cross_product(_loc4_);
      }
      
      public function toString() : String
      {
         return "Vector: (" + __x + ", " + __y + ")";
      }
      
      public function norm() : Number
      {
         return Math.sqrt(__x * __x + __y * __y);
      }
      
      public function reflect(param1:vector2d) : void
      {
         var _loc2_:vector2d = null;
         var _loc3_:Number = NaN;
         var _loc4_:Number = NaN;
         var _loc5_:Number = NaN;
         var _loc6_:Number = NaN;
         var _loc7_:Number = NaN;
         _loc2_ = new vector2d(param1.y,-param1.x);
         _loc3_ = this.angle_cosine(_loc2_);
         _loc4_ = this.angle_cosine(param1);
         if(_loc3_ > 0)
         {
            _loc5_ = 2 * Math.acos(_loc4_);
         }
         else
         {
            _loc5_ = -2 * Math.acos(_loc4_);
         }
         _loc6_ = Math.sin(_loc5_);
         _loc7_ = Math.cos(_loc5_);
         this.rotate(_loc6_,_loc7_);
      }
      
      public function cross_product(param1:vector2d) : Number
      {
         return __x * param1.y - __y * param1.x;
      }
   }
}

