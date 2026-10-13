package com.pixel.motion
{
   public class TweenTypes
   {
      
      public static const LINEAR:String = "linear";
      
      public static const EASE_IN_SINE:String = "easeInSine";
      
      public static const EASE_OUT_SINE:String = "easeOutSine";
      
      public static const EASE_INOUT_SINE:String = "easeInOutSine";
      
      public static const EASE_IN_CUBIC:String = "easeInCubic";
      
      public static const EASE_OUT_CUBIC:String = "easeOutCubic";
      
      public static const EASE_INOUT_CUBIC:String = "easeInOutCubic";
      
      public static const EASE_IN_QUINT:String = "easeInQuint";
      
      public static const EASE_OUT_QUINT:String = "easeOutQuint";
      
      public static const EASE_INOUT_QUINT:String = "easeInOutQuint";
      
      public static const EASE_IN_CIRC:String = "easeInCirc";
      
      public static const EASE_OUT_CIRC:String = "easeOutCirc";
      
      public static const EASE_INOUT_CIRC:String = "easeInOutCirc";
      
      public static const EASE_IN_BACK:String = "easeInBack";
      
      public static const EASE_OUT_BACK:String = "easeOutBack";
      
      public static const EASE_INOUT_BACK:String = "easeInOutBack";
      
      public static const EASE_IN_QUAD:String = "easeInQuad";
      
      public static const EASE_OUT_QUAD:String = "easeOutQuad";
      
      public static const EASE_INOUT_QUAD:String = "easeInOutQuad";
      
      public static const EASE_IN_QUART:String = "easeInQuart";
      
      public static const EASE_OUT_QUART:String = "easeOutQuart";
      
      public static const EASE_INOUT_QUART:String = "easeInOutQuart";
      
      public static const EASE_IN_EXPO:String = "easeInExpo";
      
      public static const EASE_OUT_EXPO:String = "easeOutExpo";
      
      public static const EASE_INOUT_EXPO:String = "easeInOutExpo";
      
      public static const EASE_IN_ELASTIC:String = "easeInElastic";
      
      public static const EASE_OUT_ELASTIC:String = "easeOutElastic";
      
      public static const EASE_INOUT_ELASTIC:String = "easeInOutElastic";
      
      public static const EASE_IN_BOUNCE:String = "easeInBounce";
      
      public static const EASE_OUT_BOUNCE:String = "easeOutBounce";
      
      public static const EASE_INOUT_BOUNCE:String = "easeInOutBounce";
      
      public function TweenTypes()
      {
         super();
      }
      
      public static function getRandomType() : String
      {
         var _loc1_:Array = null;
         _loc1_ = [LINEAR,EASE_IN_SINE,EASE_OUT_SINE,EASE_INOUT_SINE,EASE_IN_CUBIC,EASE_OUT_CUBIC,EASE_INOUT_CUBIC,EASE_IN_QUINT,EASE_OUT_QUINT,EASE_INOUT_QUINT,EASE_IN_CIRC,EASE_OUT_CIRC,EASE_INOUT_CIRC,EASE_IN_BACK,EASE_OUT_BACK,EASE_INOUT_BACK,EASE_IN_QUAD,EASE_OUT_QUAD,EASE_INOUT_QUAD,EASE_IN_QUART,EASE_OUT_QUART,EASE_INOUT_QUART,EASE_IN_EXPO,EASE_OUT_EXPO,EASE_INOUT_EXPO,EASE_IN_ELASTIC,EASE_OUT_ELASTIC,EASE_INOUT_ELASTIC,EASE_IN_BOUNCE,EASE_OUT_BOUNCE,EASE_INOUT_BOUNCE];
         return _loc1_[Math.floor(Math.random() * _loc1_.length)];
      }
   }
}

