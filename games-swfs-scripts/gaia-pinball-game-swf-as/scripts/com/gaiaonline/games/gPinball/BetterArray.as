package com.gaiaonline.games.gPinball
{
   public dynamic class BetterArray extends Array
   {
      
      public function BetterArray(... rest)
      {
         var _loc2_:Number = NaN;
         var _loc3_:Number = NaN;
         var _loc4_:Number = NaN;
         var _loc5_:Number = NaN;
         super();
         _loc2_ = Number(rest.length);
         if(_loc2_ == 1 && !isNaN(rest[0]))
         {
            _loc3_ = Number(rest[0]);
            _loc4_ = _loc3_;
            if(_loc4_ != _loc3_)
            {
               throw new Error("Array index is not a 32-bit unsigned integer (" + _loc3_ + ")");
            }
            length = _loc4_;
         }
         else
         {
            _loc5_ = 0;
            while(_loc5_ < _loc2_)
            {
               this.push(rest[_loc5_]);
               _loc5_++;
            }
            length = this.length;
         }
         this.setPropertyIsEnumerable("contains",false);
         this.setPropertyIsEnumerable("removeValue",false);
         this.setPropertyIsEnumerable("findIn",false);
         this.setPropertyIsEnumerable("randomize",false);
         this.setPropertyIsEnumerable("copy",false);
      }
      
      public function randomize() : Array
      {
         var _loc1_:Array = null;
         var _loc2_:int = 0;
         var _loc3_:int = 0;
         var _loc4_:int = 0;
         _loc1_ = new Array();
         _loc2_ = int(this.length);
         _loc3_ = 0;
         while(_loc3_ < _loc2_)
         {
            _loc4_ = NumberTools.getRandom(0,this.length - 1,false);
            _loc1_[_loc3_] = this[_loc4_];
            this.splice(_loc4_,1);
            _loc3_++;
         }
         return _loc1_;
      }
      
      public function removeValue(param1:Object) : void
      {
         var _loc2_:int = 0;
         _loc2_ = 0;
         while(_loc2_ < this.length)
         {
            if(this[_loc2_] == param1)
            {
               this.splice(_loc2_,1);
               return;
            }
            _loc2_++;
         }
      }
      
      public function contains(param1:Object) : Boolean
      {
         var _loc2_:Boolean = false;
         var _loc3_:String = null;
         _loc2_ = false;
         for(_loc3_ in this)
         {
            if(this[_loc3_] == param1)
            {
               _loc2_ = true;
            }
         }
         return _loc2_;
      }
      
      public function copy() : BetterArray
      {
         return this.slice() as BetterArray;
      }
      
      public function findIn(param1:Object) : int
      {
         var _loc2_:int = 0;
         _loc2_ = 0;
         while(_loc2_ < this.length)
         {
            if(this[_loc2_] == param1)
            {
               return _loc2_;
            }
            _loc2_++;
         }
         return -1;
      }
   }
}

