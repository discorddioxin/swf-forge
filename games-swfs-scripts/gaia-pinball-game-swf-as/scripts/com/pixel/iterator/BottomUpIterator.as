package com.pixel.iterator
{
   import flash.events.Event;
   import flash.utils.setTimeout;
   
   public class BottomUpIterator extends BaseIterator
   {
      
      public function BottomUpIterator(param1:Array, param2:Function, param3:uint, param4:uint = 1, ... rest)
      {
         super(param1,param2,param3,param4,rest);
      }
      
      override protected function runIterator() : void
      {
         var _loc1_:int = 0;
         var _loc2_:* = 0;
         _loc1_ = __currentIndex - __perFrame;
         if(_loc1_ <= 0)
         {
            _loc1_ = 0;
         }
         if(__currentIndex < 0)
         {
            dispatchEvent(new Event(ITERATIONS_COMPLETE));
            return;
         }
         _loc2_ = __currentIndex;
         while(_loc2_ > _loc1_)
         {
            __applyFunc.apply(__objectArr[_loc2_],__cbArgs);
            _loc2_--;
         }
         __currentIndex = _loc1_;
         if(_loc1_ != 0)
         {
            setTimeout(runIterator,__interval);
         }
         else
         {
            __applyFunc.apply(__objectArr[0],__cbArgs);
            dispatchEvent(new Event(ITERATIONS_COMPLETE));
         }
      }
      
      override public function start() : void
      {
         __currentIndex = __objectArr.length - 1;
         runIterator();
      }
   }
}

