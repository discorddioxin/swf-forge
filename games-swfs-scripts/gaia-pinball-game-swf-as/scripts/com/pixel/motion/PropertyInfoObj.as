package com.pixel.motion
{
   public class PropertyInfoObj
   {
      
      public var modifierParameters:Array;
      
      public var valueComplete:Number;
      
      public var modifierFunction:Function;
      
      public var hasModifier:Boolean;
      
      public var valueStart:Number;
      
      public function PropertyInfoObj(param1:Number, param2:Number, param3:Function, param4:Array)
      {
         super();
         valueStart = param1;
         valueComplete = param2;
         hasModifier = Boolean(param3);
         modifierFunction = param3;
         modifierParameters = param4;
      }
      
      public function toString() : String
      {
         var _loc1_:String = null;
         _loc1_ = "\n[PropertyInfoObj ";
         _loc1_ += "valueStart:" + String(valueStart);
         _loc1_ += ", ";
         _loc1_ += "valueComplete:" + String(valueComplete);
         _loc1_ += ", ";
         _loc1_ += "modifierFunction:" + String(modifierFunction);
         _loc1_ += ", ";
         _loc1_ += "modifierParameters:" + String(modifierParameters);
         return _loc1_ + "]\n";
      }
      
      public function clone() : PropertyInfoObj
      {
         var _loc1_:PropertyInfoObj = null;
         return new PropertyInfoObj(valueStart,valueComplete,modifierFunction,modifierParameters);
      }
   }
}

