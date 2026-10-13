package com.gaiaonline.games.gPinball.simple_elements
{
   import com.gaiaonline.games.gPinball.PinballCore;
   import flash.display.MovieClip;
   
   public class Brake extends MovieClip
   {
      
      public var __Location:String;
      
      public var __Decay:Number;
      
      public function Brake()
      {
         super();
         visible = false;
      }
      
      public function init(param1:Number, param2:String) : *
      {
         var _loc3_:int = 0;
         var _loc4_:* = undefined;
         __Location = param2;
         if(__Location == "table")
         {
            _loc3_ = 1;
            while(_loc3_ <= PinballCore.__Table.total_sections)
            {
               _loc4_ = PinballCore.__Table["sec" + _loc3_];
               if(hitTestObject(_loc4_))
               {
                  PinballCore.__Table["brakes" + _loc3_].push(this);
               }
               _loc3_++;
            }
         }
         else
         {
            PinballCore.__Table[__Location + "_brakes"].push(this);
         }
         __Decay = param1;
      }
      
      public function dTrace(param1:String) : void
      {
         PinballCore.dTrace("[Brake]",param1);
      }
   }
}

