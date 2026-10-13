package com.pixel.motion
{
   import flash.display.*;
   import flash.events.Event;
   import flash.utils.getTimer;
   
   public class Tweener
   {
      
      private static var _specialPropertySplitterList:Object;
      
      private static var _specialPropertyModifierList:Object;
      
      private static var _currentTime:Number;
      
      private static var _tweenList:Array;
      
      private static var _specialPropertyList:Object;
      
      private static var _transitionList:Object;
      
      private static var __tweener_controller__:MovieClip;
      
      private static var _engineExists:Boolean = false;
      
      private static var _inited:Boolean = false;
      
      private static var _timeScale:Number = 1;
      
      public function Tweener()
      {
         super();
      }
      
      public static function registerSpecialPropertyModifier(param1:String, param2:Function, param3:Function) : void
      {
         var _loc4_:SpecialPropertyModifier = null;
         if(!_inited)
         {
            init();
         }
         _loc4_ = new SpecialPropertyModifier(param2,param3);
         _specialPropertyModifierList[param1] = _loc4_;
      }
      
      public static function registerSpecialProperty(param1:String, param2:Function, param3:Function, param4:Array = null) : void
      {
         var _loc5_:SpecialProperty = null;
         if(!_inited)
         {
            init();
         }
         _loc5_ = new SpecialProperty(param2,param3,param4);
         _specialPropertyList[param1] = _loc5_;
      }
      
      public static function addCaller(... rest) : Boolean
      {
         var _loc2_:Array = null;
         var _loc3_:Number = NaN;
         var _loc4_:Object = null;
         var _loc5_:Number = NaN;
         var _loc6_:Number = NaN;
         var _loc7_:Function = null;
         var _loc8_:TweenListObj = null;
         var _loc9_:Number = NaN;
         var _loc10_:String = null;
         if(rest.length < 2 || rest[0] == undefined)
         {
            return false;
         }
         _loc2_ = new Array();
         if(rest[0] is Array)
         {
            _loc3_ = 0;
            while(_loc3_ < rest[0].length)
            {
               _loc2_.push(rest[0][_loc3_]);
               _loc3_++;
            }
         }
         else
         {
            _loc3_ = 0;
            while(_loc3_ < rest.length - 1)
            {
               _loc2_.push(rest[_loc3_]);
               _loc3_++;
            }
         }
         _loc4_ = rest[rest.length - 1];
         if(!_inited)
         {
            init();
         }
         if(!_engineExists || !Boolean(__tweener_controller__))
         {
            startEngine();
         }
         _loc5_ = isNaN(_loc4_.time) ? 0 : Number(_loc4_.time);
         _loc6_ = isNaN(_loc4_.delay) ? 0 : Number(_loc4_.delay);
         if(typeof _loc4_.transition == "string")
         {
            _loc10_ = _loc4_.transition.toLowerCase();
            _loc7_ = _transitionList[_loc10_];
         }
         else
         {
            _loc7_ = _loc4_.transition;
         }
         if(!Boolean(_loc7_))
         {
            _loc7_ = _transitionList["easeoutexpo"];
         }
         _loc3_ = 0;
         while(_loc3_ < _loc2_.length)
         {
            _loc8_ = new TweenListObj(_loc2_[_loc3_],_currentTime + _loc6_ * 1000 / _timeScale,_currentTime + (_loc6_ * 1000 + _loc5_ * 1000) / _timeScale,_loc4_.useFrames == true,_loc7_);
            _loc8_.properties = null;
            _loc8_.onStart = _loc4_.onStart;
            _loc8_.onUpdate = _loc4_.onUpdate;
            _loc8_.onComplete = _loc4_.onComplete;
            _loc8_.onOverwrite = _loc4_.onOverwrite;
            _loc8_.onStartParams = _loc4_.onStartParams;
            _loc8_.onUpdateParams = _loc4_.onUpdateParams;
            _loc8_.onCompleteParams = _loc4_.onCompleteParams;
            _loc8_.onOverwriteParams = _loc4_.onOverwriteParams;
            _loc8_.isCaller = true;
            _loc8_.count = _loc4_.count;
            _loc8_.waitFrames = _loc4_.waitFrames;
            _tweenList.push(_loc8_);
            if(_loc5_ == 0 && _loc6_ == 0)
            {
               _loc9_ = _tweenList.length - 1;
               updateTweenByIndex(_loc9_);
               removeTweenByIndex(_loc9_);
            }
            _loc3_++;
         }
         return true;
      }
      
      public static function init() : void
      {
         _inited = true;
         _transitionList = new Object();
         Equations.init();
         _specialPropertyList = new Object();
         _specialPropertyModifierList = new Object();
         _specialPropertySplitterList = new Object();
         SpecialPropertiesDefault.init();
      }
      
      private static function updateTweens() : Boolean
      {
         var _loc1_:* = 0;
         if(_tweenList.length == 0)
         {
            return false;
         }
         _loc1_ = 0;
         while(_loc1_ < _tweenList.length)
         {
            if(_tweenList[_loc1_] == undefined || !_tweenList[_loc1_].isPaused)
            {
               if(!updateTweenByIndex(_loc1_))
               {
                  removeTweenByIndex(_loc1_);
               }
               if(_tweenList[_loc1_] == null)
               {
                  removeTweenByIndex(_loc1_,true);
                  _loc1_--;
               }
            }
            _loc1_++;
         }
         return true;
      }
      
      public static function removeTweens(param1:Object, ... rest) : Boolean
      {
         var _loc3_:Array = null;
         var _loc4_:uint = 0;
         _loc3_ = new Array();
         _loc4_ = 0;
         while(_loc4_ < rest.length)
         {
            if(typeof rest[_loc4_] == "string" && !AuxFunctions.isInArray(rest[_loc4_],_loc3_))
            {
               _loc3_.push(rest[_loc4_]);
            }
            _loc4_++;
         }
         return affectTweens(removeTweenByIndex,param1,_loc3_);
      }
      
      public static function pauseAllTweens() : Boolean
      {
         var _loc1_:Boolean = false;
         var _loc2_:uint = 0;
         if(!Boolean(_tweenList))
         {
            return false;
         }
         _loc1_ = false;
         _loc2_ = 0;
         while(_loc2_ < _tweenList.length)
         {
            pauseTweenByIndex(_loc2_);
            _loc1_ = true;
            _loc2_++;
         }
         return _loc1_;
      }
      
      public static function splitTweens(param1:Number, param2:Array) : uint
      {
         var _loc3_:TweenListObj = null;
         var _loc4_:TweenListObj = null;
         var _loc5_:uint = 0;
         var _loc6_:String = null;
         var _loc7_:Boolean = false;
         _loc3_ = _tweenList[param1];
         _loc4_ = _loc3_.clone(false);
         _loc5_ = 0;
         while(_loc5_ < param2.length)
         {
            _loc6_ = param2[_loc5_];
            if(Boolean(_loc3_.properties[_loc6_]))
            {
               _loc3_.properties[_loc6_] = undefined;
               delete _loc3_.properties[_loc6_];
            }
            _loc5_++;
         }
         for(_loc6_ in _loc4_.properties)
         {
            _loc7_ = false;
            _loc5_ = 0;
            while(_loc5_ < param2.length)
            {
               if(param2[_loc5_] == _loc6_)
               {
                  _loc7_ = true;
                  break;
               }
               _loc5_++;
            }
            if(!_loc7_)
            {
               _loc4_.properties[_loc6_] = undefined;
               delete _loc4_.properties[_loc6_];
            }
         }
         _tweenList.push(_loc4_);
         return _tweenList.length - 1;
      }
      
      public static function resumeTweenByIndex(param1:Number) : Boolean
      {
         var _loc2_:TweenListObj = null;
         _loc2_ = _tweenList[param1];
         if(_loc2_ == null || !_loc2_.isPaused)
         {
            return false;
         }
         _loc2_.timeStart += _currentTime - _loc2_.timePaused;
         _loc2_.timeComplete += _currentTime - _loc2_.timePaused;
         _loc2_.timePaused = undefined;
         _loc2_.isPaused = false;
         return true;
      }
      
      public static function debug_getList() : String
      {
         var _loc1_:String = null;
         var _loc2_:uint = 0;
         var _loc3_:uint = 0;
         _loc1_ = "";
         _loc2_ = 0;
         while(_loc2_ < _tweenList.length)
         {
            _loc1_ += "[" + _loc2_ + "] ::\n";
            _loc3_ = 0;
            while(_loc3_ < _tweenList[_loc2_].properties.length)
            {
               _loc1_ += "  " + _tweenList[_loc2_].properties[_loc3_].name + " -> " + _tweenList[_loc2_].properties[_loc3_].valueComplete + "\n";
               _loc3_++;
            }
            _loc2_++;
         }
         return _loc1_;
      }
      
      public static function getVersion() : String
      {
         return "AS3 1.26.62";
      }
      
      public static function onEnterFrame(param1:Event) : void
      {
         var _loc2_:Boolean = false;
         updateTime();
         _loc2_ = false;
         _loc2_ = updateTweens();
         if(!_loc2_)
         {
            stopEngine();
         }
      }
      
      public static function updateTime() : void
      {
         _currentTime = getTimer();
      }
      
      private static function updateTweenByIndex(param1:Number) : Boolean
      {
         var tTweening:TweenListObj = null;
         var isOver:Boolean = false;
         var mustUpdate:Boolean = false;
         var nv:Number = NaN;
         var t:Number = NaN;
         var b:Number = NaN;
         var c:Number = NaN;
         var d:Number = NaN;
         var pName:String = null;
         var tScope:Object = null;
         var tProperty:Object = null;
         var pv:Number = NaN;
         var i:Number = param1;
         tTweening = _tweenList[i];
         if(tTweening == null || !Boolean(tTweening.scope))
         {
            return false;
         }
         isOver = false;
         if(_currentTime >= tTweening.timeStart)
         {
            tScope = tTweening.scope;
            if(tTweening.isCaller)
            {
               do
               {
                  t = (tTweening.timeComplete - tTweening.timeStart) / tTweening.count * (tTweening.timesCalled + 1);
                  b = tTweening.timeStart;
                  c = tTweening.timeComplete - tTweening.timeStart;
                  d = tTweening.timeComplete - tTweening.timeStart;
                  nv = tTweening.transition(t,b,c,d);
                  if(_currentTime >= nv)
                  {
                     if(Boolean(tTweening.onUpdate))
                     {
                        try
                        {
                           tTweening.onUpdate.apply(tScope,tTweening.onUpdateParams);
                        }
                        catch(eTweenUpdate:Error)
                        {
                           handleError(tTweening,eTweenUpdate,"onUpdate");
                        }
                     }
                     ++tTweening.timesCalled;
                     if(tTweening.timesCalled >= tTweening.count)
                     {
                        isOver = true;
                        break;
                     }
                     if(tTweening.waitFrames)
                     {
                        break;
                     }
                  }
               }
               while(_currentTime >= nv);
            }
            else
            {
               mustUpdate = tTweening.skipUpdates < 1 || !tTweening.skipUpdates || tTweening.updatesSkipped >= tTweening.skipUpdates;
               if(_currentTime >= tTweening.timeComplete)
               {
                  isOver = true;
                  mustUpdate = true;
               }
               if(!tTweening.hasStarted)
               {
                  if(Boolean(tTweening.onStart))
                  {
                     try
                     {
                        tTweening.onStart.apply(tScope,tTweening.onStartParams);
                     }
                     catch(eTweenStart:Error)
                     {
                        handleError(tTweening,eTweenStart,"onStart");
                     }
                  }
                  for(pName in tTweening.properties)
                  {
                     pv = getPropertyValue(tScope,pName);
                     tTweening.properties[pName].valueStart = isNaN(pv) ? tTweening.properties[pName].valueComplete : pv;
                  }
                  mustUpdate = true;
                  tTweening.hasStarted = true;
               }
               if(mustUpdate)
               {
                  for(pName in tTweening.properties)
                  {
                     tProperty = tTweening.properties[pName];
                     if(isOver)
                     {
                        nv = Number(tProperty.valueComplete);
                     }
                     else if(tProperty.hasModifier)
                     {
                        t = _currentTime - tTweening.timeStart;
                        d = tTweening.timeComplete - tTweening.timeStart;
                        nv = tTweening.transition(t,0,1,d);
                        nv = Number(tProperty.modifierFunction(tProperty.valueStart,tProperty.valueComplete,nv,tProperty.modifierParameters));
                     }
                     else
                     {
                        t = _currentTime - tTweening.timeStart;
                        b = Number(tProperty.valueStart);
                        c = tProperty.valueComplete - tProperty.valueStart;
                        d = tTweening.timeComplete - tTweening.timeStart;
                        nv = tTweening.transition(t,b,c,d);
                     }
                     if(tTweening.rounded)
                     {
                        nv = Math.round(nv);
                     }
                     setPropertyValue(tScope,pName,nv);
                  }
                  tTweening.updatesSkipped = 0;
                  if(Boolean(tTweening.onUpdate))
                  {
                     try
                     {
                        tTweening.onUpdate.apply(tScope,tTweening.onUpdateParams);
                     }
                     catch(eTweenUpdate2:Error)
                     {
                        handleError(tTweening,eTweenUpdate2,"onUpdate");
                     }
                  }
               }
               else
               {
                  ++tTweening.updatesSkipped;
               }
            }
            if(isOver && Boolean(tTweening.onComplete))
            {
               try
               {
                  tTweening.onComplete.apply(tScope,tTweening.onCompleteParams);
               }
               catch(eTweenComplete:Error)
               {
                  handleError(tTweening,eTweenComplete,"onComplete");
               }
            }
            return !isOver;
         }
         return true;
      }
      
      public static function setTimeScale(param1:Number) : void
      {
         var _loc2_:Number = NaN;
         if(isNaN(param1))
         {
            param1 = 1;
         }
         if(param1 < 0.00001)
         {
            param1 = 0.00001;
         }
         if(param1 != _timeScale)
         {
            if(_tweenList != null)
            {
               _loc2_ = 0;
               while(_loc2_ < _tweenList.length)
               {
                  _tweenList[_loc2_].timeStart = _currentTime - (_currentTime - _tweenList[_loc2_].timeStart) * _timeScale / param1;
                  _tweenList[_loc2_].timeComplete = _currentTime - (_currentTime - _tweenList[_loc2_].timeComplete) * _timeScale / param1;
                  if(_tweenList[_loc2_].timePaused != undefined)
                  {
                     _tweenList[_loc2_].timePaused = _currentTime - (_currentTime - _tweenList[_loc2_].timePaused) * _timeScale / param1;
                  }
                  _loc2_++;
               }
            }
            _timeScale = param1;
         }
      }
      
      public static function resumeAllTweens() : Boolean
      {
         var _loc1_:Boolean = false;
         var _loc2_:uint = 0;
         if(!Boolean(_tweenList))
         {
            return false;
         }
         _loc1_ = false;
         _loc2_ = 0;
         while(_loc2_ < _tweenList.length)
         {
            resumeTweenByIndex(_loc2_);
            _loc1_ = true;
            _loc2_++;
         }
         return _loc1_;
      }
      
      private static function handleError(param1:TweenListObj, param2:Error, param3:String) : void
      {
         var pTweening:TweenListObj = param1;
         var pError:Error = param2;
         var pCallBackName:String = param3;
         trace(pCallBackName);
         if(Boolean(pTweening.onError) && pTweening.onError is Function)
         {
            try
            {
               pTweening.onError.apply(pTweening.scope,[pTweening.scope,pError]);
            }
            catch(metaError:Error)
            {
            }
         }
         else if(Boolean(pTweening.onError))
         {
         }
      }
      
      private static function startEngine() : void
      {
         _engineExists = true;
         _tweenList = new Array();
         __tweener_controller__ = new MovieClip();
         __tweener_controller__.addEventListener(Event.ENTER_FRAME,Tweener.onEnterFrame,false,0,true);
         updateTime();
      }
      
      public static function removeAllTweens() : Boolean
      {
         var _loc1_:Boolean = false;
         var _loc2_:uint = 0;
         if(!Boolean(_tweenList))
         {
            return false;
         }
         _loc1_ = false;
         _loc2_ = 0;
         while(_loc2_ < _tweenList.length)
         {
            removeTweenByIndex(_loc2_);
            _loc1_ = true;
            _loc2_++;
         }
         return _loc1_;
      }
      
      public static function addTween(... rest) : Boolean
      {
         var _loc2_:Array = null;
         var _loc3_:Number = NaN;
         var _loc4_:String = null;
         var _loc5_:Object = null;
         var _loc6_:Number = NaN;
         var _loc7_:Number = NaN;
         var _loc8_:Array = null;
         var _loc9_:Object = null;
         var _loc10_:Object = null;
         var _loc11_:Function = null;
         var _loc12_:Object = null;
         var _loc13_:TweenListObj = null;
         var _loc14_:Number = NaN;
         var _loc15_:Array = null;
         var _loc16_:Array = null;
         var _loc17_:String = null;
         if(rest.length < 2 || rest[0] == undefined)
         {
            return false;
         }
         _loc2_ = new Array();
         if(rest[0] is Array)
         {
            _loc3_ = 0;
            while(_loc3_ < rest[0].length)
            {
               _loc2_.push(rest[0][_loc3_]);
               _loc3_++;
            }
         }
         else
         {
            _loc3_ = 0;
            while(_loc3_ < rest.length - 1)
            {
               _loc2_.push(rest[_loc3_]);
               _loc3_++;
            }
         }
         _loc5_ = TweenListObj.makePropertiesChain(rest[rest.length - 1]);
         if(!_inited)
         {
            init();
         }
         if(!_engineExists || !Boolean(__tweener_controller__))
         {
            startEngine();
         }
         _loc6_ = isNaN(_loc5_.time) ? 0 : Number(_loc5_.time);
         _loc7_ = isNaN(_loc5_.delay) ? 0 : Number(_loc5_.delay);
         _loc8_ = new Array();
         _loc9_ = {
            "time":true,
            "delay":true,
            "useFrames":true,
            "skipUpdates":true,
            "transition":true,
            "onStart":true,
            "onUpdate":true,
            "onComplete":true,
            "onOverwrite":true,
            "rounded":true,
            "onStartParams":true,
            "onUpdateParams":true,
            "onCompleteParams":true,
            "onOverwriteParams":true
         };
         _loc10_ = new Object();
         for(_loc4_ in _loc5_)
         {
            if(!_loc9_[_loc4_])
            {
               if(_specialPropertySplitterList[_loc4_])
               {
                  _loc15_ = _specialPropertySplitterList[_loc4_].splitValues(_loc5_[_loc4_],_specialPropertySplitterList[_loc4_].parameters);
                  _loc3_ = 0;
                  while(_loc3_ < _loc15_.length)
                  {
                     _loc8_[_loc15_[_loc3_].name] = {
                        "valueStart":undefined,
                        "valueComplete":_loc15_[_loc3_].value
                     };
                     _loc3_++;
                  }
               }
               else if(_specialPropertyModifierList[_loc4_] != undefined)
               {
                  _loc16_ = _specialPropertyModifierList[_loc4_].modifyValues(_loc5_[_loc4_]);
                  _loc3_ = 0;
                  while(_loc3_ < _loc16_.length)
                  {
                     _loc10_[_loc16_[_loc3_].name] = {
                        "modifierParameters":_loc16_[_loc3_].parameters,
                        "modifierFunction":_specialPropertyModifierList[_loc4_].getValue
                     };
                     _loc3_++;
                  }
               }
               else
               {
                  _loc8_[_loc4_] = {
                     "valueStart":undefined,
                     "valueComplete":_loc5_[_loc4_]
                  };
               }
            }
         }
         for(_loc4_ in _loc10_)
         {
            if(_loc8_[_loc4_] != undefined)
            {
               _loc8_[_loc4_].modifierParameters = _loc10_[_loc4_].modifierParameters;
               _loc8_[_loc4_].modifierFunction = _loc10_[_loc4_].modifierFunction;
            }
         }
         if(typeof _loc5_.transition == "string")
         {
            _loc17_ = _loc5_.transition.toLowerCase();
            _loc11_ = _transitionList[_loc17_];
         }
         else
         {
            _loc11_ = _loc5_.transition;
         }
         if(!Boolean(_loc11_))
         {
            _loc11_ = _transitionList["linear"];
         }
         _loc3_ = 0;
         while(_loc3_ < _loc2_.length)
         {
            _loc12_ = new Object();
            for(_loc4_ in _loc8_)
            {
               _loc12_[_loc4_] = new PropertyInfoObj(_loc8_[_loc4_].valueStart,_loc8_[_loc4_].valueComplete,_loc8_[_loc4_].modifierFunction,_loc8_[_loc4_].modifierParameters);
            }
            _loc13_ = new TweenListObj(_loc2_[_loc3_],_currentTime + _loc7_ * 1000 / _timeScale,_currentTime + (_loc7_ * 1000 + _loc6_ * 1000) / _timeScale,_loc5_.useFrames == true,_loc11_);
            _loc13_.properties = _loc12_;
            _loc13_.onStart = _loc5_.onStart;
            _loc13_.onUpdate = _loc5_.onUpdate;
            _loc13_.onComplete = _loc5_.onComplete;
            _loc13_.onOverwrite = _loc5_.onOverwrite;
            _loc13_.onError = _loc5_.onError;
            _loc13_.onStartParams = _loc5_.onStartParams;
            _loc13_.onUpdateParams = _loc5_.onUpdateParams;
            _loc13_.onCompleteParams = _loc5_.onCompleteParams;
            _loc13_.onOverwriteParams = _loc5_.onOverwriteParams;
            _loc13_.rounded = _loc5_.rounded;
            _loc13_.skipUpdates = _loc5_.skipUpdates;
            removeTweensByTime(_loc13_.scope,_loc13_.properties,_loc13_.timeStart,_loc13_.timeComplete);
            _tweenList.push(_loc13_);
            if(_loc6_ == 0 && _loc7_ == 0)
            {
               _loc14_ = _tweenList.length - 1;
               updateTweenByIndex(_loc14_);
               removeTweenByIndex(_loc14_);
            }
            _loc3_++;
         }
         return true;
      }
      
      public static function registerTransition(param1:String, param2:Function) : void
      {
         if(!_inited)
         {
            init();
         }
         _transitionList[param1] = param2;
      }
      
      private static function affectTweens(param1:Function, param2:Object, param3:Array) : Boolean
      {
         var _loc4_:Boolean = false;
         var _loc5_:uint = 0;
         var _loc6_:Array = null;
         var _loc7_:uint = 0;
         var _loc8_:uint = 0;
         var _loc9_:uint = 0;
         _loc4_ = false;
         if(!Boolean(_tweenList))
         {
            return false;
         }
         _loc5_ = 0;
         while(_loc5_ < _tweenList.length)
         {
            if(Boolean(_tweenList[_loc5_]) && _tweenList[_loc5_].scope == param2)
            {
               if(param3.length == 0)
               {
                  param1(_loc5_);
                  _loc4_ = true;
               }
               else
               {
                  _loc6_ = new Array();
                  _loc7_ = 0;
                  while(_loc7_ < param3.length)
                  {
                     if(Boolean(_tweenList[_loc5_].properties[param3[_loc7_]]))
                     {
                        _loc6_.push(param3[_loc7_]);
                     }
                     _loc7_++;
                  }
                  if(_loc6_.length > 0)
                  {
                     _loc8_ = AuxFunctions.getObjectLength(_tweenList[_loc5_].properties);
                     if(_loc8_ == _loc6_.length)
                     {
                        param1(_loc5_);
                        _loc4_ = true;
                     }
                     else
                     {
                        _loc9_ = splitTweens(_loc5_,_loc6_);
                        param1(_loc9_);
                        _loc4_ = true;
                     }
                  }
               }
            }
            _loc5_++;
         }
         return _loc4_;
      }
      
      public static function getTweens(param1:Object) : Array
      {
         var _loc2_:uint = 0;
         var _loc3_:String = null;
         var _loc4_:Array = null;
         if(!Boolean(_tweenList))
         {
            return [];
         }
         _loc4_ = new Array();
         _loc2_ = 0;
         while(_loc2_ < _tweenList.length)
         {
            if(_tweenList[_loc2_].scope == param1)
            {
               for(_loc3_ in _tweenList[_loc2_].properties)
               {
                  _loc4_.push(_loc3_);
               }
            }
            _loc2_++;
         }
         return _loc4_;
      }
      
      private static function setPropertyValue(param1:Object, param2:String, param3:Number) : void
      {
         if(_specialPropertyList[param2] != undefined)
         {
            if(Boolean(_specialPropertyList[param2].parameters))
            {
               _specialPropertyList[param2].setValue(param1,param3,_specialPropertyList[param2].parameters);
            }
            else
            {
               _specialPropertyList[param2].setValue(param1,param3);
            }
         }
         else
         {
            param1[param2] = param3;
         }
      }
      
      private static function getPropertyValue(param1:Object, param2:String) : Number
      {
         if(_specialPropertyList[param2] != undefined)
         {
            if(Boolean(_specialPropertyList[param2].parameters))
            {
               return _specialPropertyList[param2].getValue(param1,_specialPropertyList[param2].parameters);
            }
            return _specialPropertyList[param2].getValue(param1);
         }
         return param1[param2];
      }
      
      public static function isTweening(param1:Object) : Boolean
      {
         var _loc2_:uint = 0;
         if(!Boolean(_tweenList))
         {
            return false;
         }
         _loc2_ = 0;
         while(_loc2_ < _tweenList.length)
         {
            if(_tweenList[_loc2_].scope == param1)
            {
               return true;
            }
            _loc2_++;
         }
         return false;
      }
      
      public static function getTweenCount(param1:Object) : Number
      {
         var _loc2_:uint = 0;
         var _loc3_:Number = NaN;
         if(!Boolean(_tweenList))
         {
            return 0;
         }
         _loc3_ = 0;
         _loc2_ = 0;
         while(_loc2_ < _tweenList.length)
         {
            if(_tweenList[_loc2_].scope == param1)
            {
               _loc3_ += AuxFunctions.getObjectLength(_tweenList[_loc2_].properties);
            }
            _loc2_++;
         }
         return _loc3_;
      }
      
      private static function stopEngine() : void
      {
         _engineExists = false;
         _tweenList = null;
         _currentTime = 0;
         __tweener_controller__.removeEventListener(Event.ENTER_FRAME,Tweener.onEnterFrame);
         __tweener_controller__ = null;
      }
      
      public static function pauseTweenByIndex(param1:Number) : Boolean
      {
         var _loc2_:TweenListObj = null;
         _loc2_ = _tweenList[param1];
         if(_loc2_ == null || _loc2_.isPaused)
         {
            return false;
         }
         _loc2_.timePaused = _currentTime;
         _loc2_.isPaused = true;
         return true;
      }
      
      public static function removeTweensByTime(param1:Object, param2:Object, param3:Number, param4:Number) : Boolean
      {
         var removed:Boolean = false;
         var removedLocally:Boolean = false;
         var i:uint = 0;
         var tl:uint = 0;
         var pName:String = null;
         var p_scope:Object = param1;
         var p_properties:Object = param2;
         var p_timeStart:Number = param3;
         var p_timeComplete:Number = param4;
         removed = false;
         tl = _tweenList.length;
         i = 0;
         while(i < tl)
         {
            if(Boolean(_tweenList[i]) && p_scope == _tweenList[i].scope)
            {
               if(p_timeComplete > _tweenList[i].timeStart && p_timeStart < _tweenList[i].timeComplete)
               {
                  removedLocally = false;
                  for(pName in _tweenList[i].properties)
                  {
                     if(Boolean(p_properties[pName]))
                     {
                        if(Boolean(_tweenList[i].onOverwrite))
                        {
                           try
                           {
                              _tweenList[i].onOverwrite.apply(_tweenList[i].scope,_tweenList[i].onOverwriteParams);
                           }
                           catch(e:Error)
                           {
                              handleError(_tweenList[i],e,"onOverwrite");
                           }
                        }
                        _tweenList[i].properties[pName] = undefined;
                        delete _tweenList[i].properties[pName];
                        removedLocally = true;
                        removed = true;
                     }
                  }
                  if(removedLocally)
                  {
                     if(AuxFunctions.getObjectLength(_tweenList[i].properties) == 0)
                     {
                        removeTweenByIndex(i);
                     }
                  }
               }
            }
            i++;
         }
         return removed;
      }
      
      public static function registerSpecialPropertySplitter(param1:String, param2:Function, param3:Array = null) : void
      {
         var _loc4_:SpecialPropertySplitter = null;
         if(!_inited)
         {
            init();
         }
         _loc4_ = new SpecialPropertySplitter(param2,param3);
         _specialPropertySplitterList[param1] = _loc4_;
      }
      
      public static function removeTweenByIndex(param1:Number, param2:Boolean = false) : Boolean
      {
         _tweenList[param1] = null;
         if(param2)
         {
            _tweenList.splice(param1,1);
         }
         return true;
      }
      
      public static function resumeTweens(param1:Object, ... rest) : Boolean
      {
         var _loc3_:Array = null;
         var _loc4_:uint = 0;
         _loc3_ = new Array();
         _loc4_ = 0;
         while(_loc4_ < rest.length)
         {
            if(typeof rest[_loc4_] == "string" && !AuxFunctions.isInArray(rest[_loc4_],_loc3_))
            {
               _loc3_.push(rest[_loc4_]);
            }
            _loc4_++;
         }
         return affectTweens(resumeTweenByIndex,param1,_loc3_);
      }
      
      public static function pauseTweens(param1:Object, ... rest) : Boolean
      {
         var _loc3_:Array = null;
         var _loc4_:uint = 0;
         _loc3_ = new Array();
         _loc4_ = 0;
         while(_loc4_ < rest.length)
         {
            if(typeof rest[_loc4_] == "string" && !AuxFunctions.isInArray(rest[_loc4_],_loc3_))
            {
               _loc3_.push(rest[_loc4_]);
            }
            _loc4_++;
         }
         return affectTweens(pauseTweenByIndex,param1,_loc3_);
      }
   }
}

