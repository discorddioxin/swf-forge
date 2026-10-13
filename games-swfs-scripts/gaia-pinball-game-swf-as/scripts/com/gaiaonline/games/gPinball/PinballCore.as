package com.gaiaonline.games.gPinball
{
   public class PinballCore
   {
      
      public static var __Root:Pinball;
      
      public static var __Gateway:Boolean;
      
      public static var __EFM:EnterFrameManager;
      
      public static var __KeyboardIO:Boolean;
      
      public static var __Table:PinballTable;
      
      public function PinballCore()
      {
         super();
      }
      
      public static function dTrace(param1:String, param2:String) : void
      {
         switch(param2.substr(0,6))
         {
            case "Score:":
         }
         trace("GAIAPINBALL" + param1 + " " + param2);
      }
      
      public static function keyboardInput(param1:Boolean) : void
      {
         __KeyboardIO = param1;
      }
   }
}

