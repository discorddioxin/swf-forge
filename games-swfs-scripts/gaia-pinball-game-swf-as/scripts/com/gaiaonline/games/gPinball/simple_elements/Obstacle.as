package com.gaiaonline.games.gPinball.simple_elements
{
   import com.gaiaonline.games.gPinball.NumberTools;
   import com.gaiaonline.games.gPinball.PinballCore;
   import com.gaiaonline.games.gPinball.compound_elements.TargetMoving;
   import flash.display.MovieClip;
   import flash.events.Event;
   import flash.geom.Point;
   
   public class Obstacle extends MovieClip
   {
      
      public var power:Number;
      
      public var __Active:Boolean;
      
      public var __MaxPower:Number = 0;
      
      public var __Friction:Number = 0.98;
      
      public var id:int = -1;
      
      public var min_power:Number;
      
      public var TriggerFunction:Function;
      
      public var hit:MovieClip;
      
      public var __Location:String;
      
      public var decay:Number;
      
      public var __Decay:Number;
      
      public var __MinPower:Number = 0;
      
      public var __DefaultDecay:Number = 0.4;
      
      public function Obstacle()
      {
         super();
         visible = false;
      }
      
      public function get active() : Boolean
      {
         return __Active;
      }
      
      public function init(param1:Number, param2:Number, param3:String, param4:Function, param5:Number = 0) : void
      {
         var _loc6_:Array = null;
         var _loc7_:uint = 0;
         var _loc8_:MovieClip = null;
         var _loc9_:Array = null;
         __Location = param3;
         if(!isNaN(param1))
         {
            __Decay = param1;
         }
         else
         {
            __Decay = __DefaultDecay;
         }
         __Active = true;
         hit.width *= scaleX;
         scaleX = 1;
         scaleY = 1;
         if(param2 != 0)
         {
            __MaxPower = param2;
         }
         if(param5 != 0)
         {
            __MinPower = param5;
         }
         if(param4 != null)
         {
            TriggerFunction = param4;
         }
         _loc6_ = new Array();
         _loc7_ = 1;
         while(_loc7_ <= PinballCore.__Table.total_sections)
         {
            _loc8_ = PinballCore.__Table["sec" + _loc7_];
            if(__Location == "table")
            {
               _loc9_ = PinballCore.__Table["obstacles" + _loc7_];
            }
            else
            {
               _loc9_ = PinballCore.__Table[__Location + "_obstacles" + _loc7_];
            }
            if(parent is TargetMoving)
            {
               _loc6_.push(_loc9_);
               _loc9_.push(this);
            }
            else if(hitTestObject(_loc8_))
            {
               _loc6_.push(_loc9_);
               _loc9_.push(this);
            }
            _loc7_++;
         }
         hit.markers.visible = true;
      }
      
      public function setActive(param1:Boolean) : void
      {
         __Active = param1;
      }
      
      public function check(param1:Point, param2:Point, param3:Ball) : Object
      {
         var _loc4_:Point = null;
         var _loc5_:Point = null;
         var _loc6_:Point = null;
         var _loc7_:Number = NaN;
         var _loc8_:Number = NaN;
         var _loc9_:Object = null;
         var _loc10_:Number = NaN;
         if(__Active)
         {
            _loc4_ = param1.clone();
            _loc5_ = param2.clone();
            _loc5_ = PinballCore.__Table.localToGlobal(_loc5_);
            _loc5_ = globalToLocal(_loc5_);
            _loc4_ = PinballCore.__Table.localToGlobal(_loc4_);
            _loc4_ = globalToLocal(_loc4_);
            if(_loc5_.y >= -param3.radius && _loc4_.y < 0 && _loc5_.y > _loc4_.y)
            {
               _loc6_ = _loc5_.subtract(_loc4_);
               _loc7_ = -param3.radius / 2;
               _loc8_ = hit.width + param3.radius / 2;
               if(_loc4_.x <= _loc8_ && _loc5_.x >= _loc7_ || _loc4_.x >= _loc7_ && _loc5_.x <= _loc8_)
               {
                  _loc9_ = new Object();
                  _loc9_.pos_pt = new Point(_loc5_.x,-param3.radius);
                  _loc9_.pos_pt = localToGlobal(_loc9_.pos_pt);
                  _loc9_.pos_pt = PinballCore.__Table.globalToLocal(_loc9_.pos_pt);
                  if(__MinPower != 0)
                  {
                     _loc10_ = NumberTools.getRandom(__MinPower,__MaxPower,true);
                  }
                  else
                  {
                     _loc10_ = __MaxPower;
                  }
                  _loc9_.new_v = new Point(_loc4_.x + _loc6_.x,_loc4_.y + (_loc6_.y * -__Decay - _loc10_));
                  _loc9_.new_v = localToGlobal(_loc9_.new_v);
                  _loc9_.obst = this;
                  if(TriggerFunction != null)
                  {
                     TriggerFunction(id);
                  }
                  return _loc9_;
               }
               return null;
            }
            return null;
         }
         return null;
      }
      
      public function set active(param1:Boolean) : void
      {
         __Active = param1;
      }
      
      public function dTrace(param1:String) : void
      {
         PinballCore.dTrace("[Obstacle]",param1);
      }
      
      public function ClearMem() : void
      {
         __Location = null;
         TriggerFunction = null;
         dispatchEvent(new Event("doneClearMem"));
      }
      
      public function setDecay(param1:Number) : void
      {
         __Decay = param1;
      }
      
      public function setPower(param1:Number, param2:Number) : void
      {
         __MaxPower = param1;
         __MinPower = param2;
      }
   }
}

