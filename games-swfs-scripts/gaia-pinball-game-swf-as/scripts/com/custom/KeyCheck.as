package com.custom
{
   import flash.display.Stage;
   import flash.events.Event;
   import flash.events.KeyboardEvent;
   
   public class KeyCheck
   {
      
      private static var initialized:Boolean = false;
      
      private static var keysDown:Object = new Object();
      
      public function KeyCheck()
      {
         super();
      }
      
      public static function initialize(param1:Stage) : void
      {
         if(!initialized)
         {
            param1.addEventListener(KeyboardEvent.KEY_DOWN,keyPressed,false,0,true);
            param1.addEventListener(KeyboardEvent.KEY_UP,keyReleased,false,0,true);
            param1.addEventListener(Event.DEACTIVATE,clearKeys,false,0,true);
            initialized = true;
         }
      }
      
      private static function clearKeys(param1:Event) : void
      {
         keysDown = new Object();
      }
      
      public static function isDown(param1:uint) : Boolean
      {
         if(!initialized)
         {
            throw new Error("Key class has yet been initialized.");
         }
         return Boolean(param1 in keysDown);
      }
      
      private static function keyPressed(param1:KeyboardEvent) : void
      {
         keysDown[param1.keyCode] = true;
      }
      
      public static function deactivate(param1:Stage) : void
      {
         if(initialized)
         {
            param1.removeEventListener(KeyboardEvent.KEY_DOWN,keyPressed);
            param1.removeEventListener(KeyboardEvent.KEY_UP,keyReleased);
            param1.removeEventListener(Event.DEACTIVATE,clearKeys);
            initialized = false;
         }
      }
      
      private static function keyReleased(param1:KeyboardEvent) : void
      {
         if(param1.keyCode in keysDown)
         {
            delete keysDown[param1.keyCode];
         }
      }
   }
}

