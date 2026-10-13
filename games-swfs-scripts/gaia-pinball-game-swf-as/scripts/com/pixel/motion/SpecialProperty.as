package com.pixel.motion
{
   public class SpecialProperty
   {
      
      public var parameters:Array;
      
      public var getValue:Function;
      
      public var setValue:Function;
      
      public function SpecialProperty(param1:Function, param2:Function, param3:Array = null)
      {
         super();
         getValue = param1;
         setValue = param2;
         parameters = param3;
      }
      
      public function toString() : String
      {
         var _loc1_:String = null;
         _loc1_ = "";
         _loc1_ += "[SpecialProperty ";
         _loc1_ += "getValue:" + String(getValue);
         _loc1_ += ", ";
         _loc1_ += "setValue:" + String(setValue);
         _loc1_ += ", ";
         _loc1_ += "parameters:" + String(parameters);
         return _loc1_ + "]";
      }
   }
}

