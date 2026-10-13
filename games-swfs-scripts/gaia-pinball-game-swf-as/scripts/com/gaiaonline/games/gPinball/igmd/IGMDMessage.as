package com.gaiaonline.games.gPinball.igmd
{
   public class IGMDMessage
   {
      
      public var id:String;
      
      public function IGMDMessage(param1:String = null)
      {
         super();
         if(param1)
         {
            id = param1;
         }
      }
   }
}

