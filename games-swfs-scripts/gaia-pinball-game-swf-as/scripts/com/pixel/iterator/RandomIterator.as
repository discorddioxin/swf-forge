package com.pixel.iterator
{
   import flash.events.Event;
   import flash.utils.setTimeout;
   
   public class RandomIterator extends BaseIterator
   {
      
      public function RandomIterator(param1:Array, param2:Function, param3:uint, param4:uint = 1, ... rest)
      {
         var _loc6_:Array = null;
         _loc6_ = param1.slice();
         super(_loc6_,param2,param3,param4,rest);
      }
      
      override protected function runIterator() : void
      {
         var _loc1_:uint = 0;
         var _loc2_:uint = 0;
         var _loc3_:int = 0;
         _loc1_ = __perFrame;
         if(_loc1_ > __objectArr.length)
         {
            _loc1_ = __objectArr.length;
         }
         _loc2_ = 0;
         while(_loc2_ < _loc1_)
         {
            _loc3_ = Math.round(Math.random() * (__objectArr.length - 1));
            __applyFunc.apply(__objectArr[_loc3_],__cbArgs);
            __objectArr.splice(_loc3_,1);
            _loc2_++;
         }
         if(__objectArr.length != 0)
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

