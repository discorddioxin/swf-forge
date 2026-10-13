package com.gaiaonline.games.gPinball
{
   public class NumberTools
   {
      
      public function NumberTools()
      {
         super();
      }
      
      public static function sigDigits(param1:Number, param2:Number) : Number
      {
         var _loc3_:Number = NaN;
         var _loc4_:Number = NaN;
         _loc3_ = 1000;
         switch(param2)
         {
            case 1:
               _loc3_ = 10;
               break;
            case 2:
               _loc3_ = 100;
               break;
            case 3:
               _loc3_ = 1000;
               break;
            case 4:
               _loc3_ = 10000;
               break;
            default:
               _loc3_ = 1;
         }
         return Math.round(param1 * _loc3_) / _loc3_;
      }
      
      public static function getRandom(param1:Number, param2:Number, param3:Boolean) : Number
      {
         if(!param3)
         {
            return param1 + Math.floor(Math.random() * (param2 + 1 - param1));
         }
         return param1 + Math.random() * (param2 - param1);
      }
      
      public static function toDegrees(param1:Number) : Number
      {
         return param1 / 3.141593 * 180;
      }
      
      public static function addCommas(param1:Number) : String
      {
         var _loc2_:String = null;
         var _loc3_:int = 0;
         var _loc4_:int = 0;
         var _loc5_:String = null;
         var _loc6_:int = 0;
         _loc2_ = param1.toString();
         _loc3_ = Math.floor(_loc2_.length / 3);
         _loc4_ = _loc2_.length - _loc3_ * 3;
         _loc5_ = _loc2_.substr(_loc2_.length - 3,3);
         _loc6_ = 2;
         while(_loc6_ <= _loc3_)
         {
            _loc5_ = _loc2_.substr(_loc2_.length - _loc6_ * 3,3) + "," + _loc5_;
            _loc6_++;
         }
         if(Boolean(_loc4_) && Boolean(_loc3_))
         {
            _loc5_ = _loc2_.substr(0,_loc4_) + "," + _loc5_;
         }
         return _loc5_;
      }
      
      public static function toRadians(param1:Number) : Number
      {
         return param1 / 180 * 3.141593;
      }
   }
}

