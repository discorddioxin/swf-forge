package com.pixel.iterator
{
   import flash.events.Event;
   import flash.utils.setTimeout;
   
   public class TopDownIterator extends BaseIterator
   {
      
      public function TopDownIterator(param1:Array, param2:Function, param3:uint, param4:uint = 1, ... rest)
      {
         super(param1,param2,param3,param4,rest);
      }
      
      override protected function runIterator() : void
      {
         var _loc1_:uint = 0;
         var _loc2_:uint = 0;
         _loc1_ = __currentIndex + __perFrame;
         if(!__objectArr[_loc1_])
         {
            _loc1_ = __objectArr.length;
         }
         _loc2_ = uint(__currentIndex);
         while(_loc2_ < _loc1_)
         {
            __applyFunc.apply(__objectArr[_loc2_],__cbArgs);
            _loc2_++;
         }
         __currentIndex = _loc1_;
         if(__objectArr[_loc1_])
         {
            setTimeout(runIterator,__interval);
         }
         else
         {
            dispatchEvent(new Event(ITERATIONS_COMPLETE));
         }
      }
   }
}

