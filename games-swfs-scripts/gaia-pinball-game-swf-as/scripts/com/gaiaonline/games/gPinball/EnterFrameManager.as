package com.gaiaonline.games.gPinball
{
   import flash.events.Event;
   
   public class EnterFrameManager
   {
      
      public var __Active:Boolean;
      
      public var count:int = 0;
      
      public var functions:Object = new Object();
      
      public function EnterFrameManager()
      {
         super();
         __Active = false;
      }
      
      public function start() : void
      {
         __Active = true;
         PinballCore.__Root.addEventListener("enterFrame",update,false,0,true);
      }
      
      public function dTrace(param1:String) : void
      {
         PinballCore.dTrace("[EFM]",param1);
      }
      
      public function stop() : void
      {
         __Active = false;
         PinballCore.__Root.removeEventListener("enterFrame",update);
      }
      
      public function update(param1:Event) : void
      {
         var _loc2_:* = undefined;
         for(_loc2_ in functions)
         {
            functions[_loc2_]();
         }
      }
      
      public function clearAll() : void
      {
         var _loc1_:* = undefined;
         for(_loc1_ in functions)
         {
            delete functions[_loc1_];
         }
         PinballCore.__Root.removeEventListener("enterFrame",update);
      }
      
      public function addFunction(param1:Object, param2:String) : int
      {
         ++count;
         functions["f" + count] = param1[param2];
         return count;
      }
      
      public function removeFunction(param1:int) : Boolean
      {
         if(functions["f" + param1])
         {
            delete functions["f" + param1];
            return true;
         }
         return false;
      }
   }
}

