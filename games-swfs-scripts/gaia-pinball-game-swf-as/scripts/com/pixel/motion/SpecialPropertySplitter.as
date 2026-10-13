package com.pixel.motion
{
   public class SpecialPropertySplitter
   {
      
      public var parameters:Array;
      
      public var splitValues:Function;
      
      public function SpecialPropertySplitter(param1:Function, ... rest)
      {
         super();
         splitValues = param1;
      }
      
      public function toString() : String
      {
         var _loc1_:String = null;
         _loc1_ = "";
         _loc1_ += "[SpecialPropertySplitter ";
         _loc1_ += "splitValues:" + String(splitValues);
         _loc1_ += ", ";
         _loc1_ += "parameters:" + String(parameters);
         return _loc1_ + "]";
      }
   }
}

