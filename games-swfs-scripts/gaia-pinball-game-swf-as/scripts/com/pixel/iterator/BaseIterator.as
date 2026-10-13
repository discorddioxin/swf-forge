package com.pixel.iterator
{
   import flash.events.Event;
   import flash.events.EventDispatcher;
   import flash.utils.setTimeout;
   
   public class BaseIterator extends EventDispatcher
   {
      
      public static var ITERATIONS_COMPLETE:String = "iterationsComplete";
      
      protected var __objectArr:Array;
      
      protected var __interval:uint;
      
      protected var __perFrame:uint;
      
      protected var __applyFunc:Function;
      
      protected var __currentIndex:int;
      
      protected var __cbArgs:Array;
      
      public function BaseIterator(param1:Array, param2:Function, param3:uint, param4:uint = 1, ... rest)
      {
         super();
         __objectArr = param1;
         __applyFunc = param2;
         __interval = param3;
         __perFrame = param4;
         __cbArgs = rest;
         __currentIndex = 0;
      }
      
      public static function getRandomIterator() : Class
      {
         var _loc1_:Array = null;
         _loc1_ = [RandomIterator,TopDownIterator,BottomUpIterator,CompleteIterator];
         return _loc1_[Math.floor(Math.random() * _loc1_.length)];
      }
      
      public function start() : void
      {
         runIterator();
      }
      
      protected function runIterator() : void
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

