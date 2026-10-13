package com.pixel.motion
{
   public class TweenListObj
   {
      
      public var onUpdate:Function;
      
      public var useFrames:Boolean;
      
      public var hasStarted:Boolean;
      
      public var onOverwriteParams:Array;
      
      public var timeStart:Number;
      
      public var count:Number;
      
      public var auxProperties:Object;
      
      public var timeComplete:Number;
      
      public var onStartParams:Array;
      
      public var rounded:Boolean;
      
      public var properties:Object;
      
      public var onUpdateParams:Array;
      
      public var onComplete:Function;
      
      public var updatesSkipped:Number;
      
      public var onStart:Function;
      
      public var skipUpdates:Number;
      
      public var scope:Object;
      
      public var isCaller:Boolean;
      
      public var timePaused:Number;
      
      public var transition:Function;
      
      public var onCompleteParams:Array;
      
      public var onError:Function;
      
      public var timesCalled:Number;
      
      public var onOverwrite:Function;
      
      public var isPaused:Boolean;
      
      public var waitFrames:Boolean;
      
      public function TweenListObj(param1:Object, param2:Number, param3:Number, param4:Boolean, param5:Function)
      {
         super();
         scope = param1;
         timeStart = param2;
         timeComplete = param3;
         useFrames = param4;
         transition = param5;
         auxProperties = new Object();
         properties = new Object();
         isPaused = false;
         timePaused = undefined;
         isCaller = false;
         updatesSkipped = 0;
         timesCalled = 0;
         skipUpdates = 0;
         hasStarted = false;
      }
      
      public static function makePropertiesChain(param1:Object) : Object
      {
         var _loc2_:Object = null;
         var _loc3_:Object = null;
         var _loc4_:Object = null;
         var _loc5_:Object = null;
         var _loc6_:Number = NaN;
         var _loc7_:Number = NaN;
         var _loc8_:Number = NaN;
         _loc2_ = param1.base;
         if(_loc2_)
         {
            _loc3_ = {};
            if(_loc2_ is Array)
            {
               _loc4_ = [];
               _loc8_ = 0;
               while(_loc8_ < _loc2_.length)
               {
                  _loc4_.push(_loc2_[_loc8_]);
                  _loc8_++;
               }
            }
            else
            {
               _loc4_ = [_loc2_];
            }
            _loc4_.push(param1);
            _loc6_ = Number(_loc4_.length);
            _loc7_ = 0;
            while(_loc7_ < _loc6_)
            {
               if(_loc4_[_loc7_]["base"])
               {
                  _loc5_ = AuxFunctions.concatObjects(makePropertiesChain(_loc4_[_loc7_]["base"]),_loc4_[_loc7_]);
               }
               else
               {
                  _loc5_ = _loc4_[_loc7_];
               }
               _loc3_ = AuxFunctions.concatObjects(_loc3_,_loc5_);
               _loc7_++;
            }
            if(_loc3_["base"])
            {
               delete _loc3_["base"];
            }
            return _loc3_;
         }
         return param1;
      }
      
      public function clone(param1:Boolean) : TweenListObj
      {
         var _loc2_:TweenListObj = null;
         var _loc3_:String = null;
         _loc2_ = new TweenListObj(scope,timeStart,timeComplete,useFrames,transition);
         _loc2_.properties = new Array();
         for(_loc3_ in properties)
         {
            _loc2_.properties[_loc3_] = properties[_loc3_].clone();
         }
         _loc2_.skipUpdates = skipUpdates;
         _loc2_.updatesSkipped = updatesSkipped;
         if(!param1)
         {
            _loc2_.onStart = onStart;
            _loc2_.onUpdate = onUpdate;
            _loc2_.onComplete = onComplete;
            _loc2_.onOverwrite = onOverwrite;
            _loc2_.onError = onError;
            _loc2_.onStartParams = onStartParams;
            _loc2_.onUpdateParams = onUpdateParams;
            _loc2_.onCompleteParams = onCompleteParams;
            _loc2_.onOverwriteParams = onOverwriteParams;
         }
         _loc2_.rounded = rounded;
         _loc2_.isPaused = isPaused;
         _loc2_.timePaused = timePaused;
         _loc2_.isCaller = isCaller;
         _loc2_.count = count;
         _loc2_.timesCalled = timesCalled;
         _loc2_.waitFrames = waitFrames;
         _loc2_.hasStarted = hasStarted;
         return _loc2_;
      }
      
      public function toString() : String
      {
         var _loc1_:String = null;
         var _loc2_:uint = 0;
         _loc1_ = "\n[TweenListObj ";
         _loc1_ += "scope:" + String(scope);
         _loc1_ += ", properties:";
         _loc2_ = 0;
         while(_loc2_ < properties.length)
         {
            if(_loc2_ > 0)
            {
               _loc1_ += ",";
            }
            _loc1_ += "[name:" + properties[_loc2_].name;
            _loc1_ += ",valueStart:" + properties[_loc2_].valueStart;
            _loc1_ += ",valueComplete:" + properties[_loc2_].valueComplete;
            _loc1_ += "]";
            _loc2_++;
         }
         _loc1_ += ", timeStart:" + String(timeStart);
         _loc1_ += ", timeComplete:" + String(timeComplete);
         _loc1_ += ", useFrames:" + String(useFrames);
         _loc1_ += ", transition:" + String(transition);
         if(skipUpdates)
         {
            _loc1_ += ", skipUpdates:" + String(skipUpdates);
         }
         if(updatesSkipped)
         {
            _loc1_ += ", updatesSkipped:" + String(updatesSkipped);
         }
         if(Boolean(onStart))
         {
            _loc1_ += ", onStart:" + String(onStart);
         }
         if(Boolean(onUpdate))
         {
            _loc1_ += ", onUpdate:" + String(onUpdate);
         }
         if(Boolean(onComplete))
         {
            _loc1_ += ", onComplete:" + String(onComplete);
         }
         if(Boolean(onOverwrite))
         {
            _loc1_ += ", onOverwrite:" + String(onOverwrite);
         }
         if(Boolean(onError))
         {
            _loc1_ += ", onError:" + String(onError);
         }
         if(onStartParams)
         {
            _loc1_ += ", onStartParams:" + String(onStartParams);
         }
         if(onUpdateParams)
         {
            _loc1_ += ", onUpdateParams:" + String(onUpdateParams);
         }
         if(onCompleteParams)
         {
            _loc1_ += ", onCompleteParams:" + String(onCompleteParams);
         }
         if(onOverwriteParams)
         {
            _loc1_ += ", onOverwriteParams:" + String(onOverwriteParams);
         }
         if(rounded)
         {
            _loc1_ += ", rounded:" + String(rounded);
         }
         if(isPaused)
         {
            _loc1_ += ", isPaused:" + String(isPaused);
         }
         if(timePaused)
         {
            _loc1_ += ", timePaused:" + String(timePaused);
         }
         if(isCaller)
         {
            _loc1_ += ", isCaller:" + String(isCaller);
         }
         if(count)
         {
            _loc1_ += ", count:" + String(count);
         }
         if(timesCalled)
         {
            _loc1_ += ", timesCalled:" + String(timesCalled);
         }
         if(waitFrames)
         {
            _loc1_ += ", waitFrames:" + String(waitFrames);
         }
         if(hasStarted)
         {
            _loc1_ += ", hasStarted:" + String(hasStarted);
         }
         return _loc1_ + "]\n";
      }
   }
}

