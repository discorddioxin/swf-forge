package com.pixel.iterator
{
   public class CompleteIterator extends TopDownIterator
   {
      
      public function CompleteIterator(param1:Array, param2:Function, param3:uint, param4:uint = 1, ... rest)
      {
         param3 = 0;
         param4 = 0;
         super(param1,param2,0,param1.length,rest);
      }
   }
}

