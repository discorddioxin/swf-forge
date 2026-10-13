package com.gaiaonline.gameFramework.events
{
   import flash.events.Event;
   
   public class GaiaGameEvent extends Event
   {
      
      public static const SAVE_GAME:String = "SAVE_GAME";
      
      public static const NEW_GAME_REQUEST:String = "NEW_GAME_REQUEST";
      
      public static const GAME_STARTED:String = "GAME_STARTED";
      
      public static const NEXT_LEVEL_CLICKED:String = "NEXT_LEVEL_CLICKED";
      
      public function GaiaGameEvent(param1:String)
      {
         super(param1);
      }
   }
}

