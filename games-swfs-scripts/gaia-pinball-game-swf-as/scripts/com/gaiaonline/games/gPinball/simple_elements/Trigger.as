package com.gaiaonline.games.gPinball.simple_elements
{
   import com.gaiaonline.games.gPinball.PinballCore;
   import com.gaiaonline.games.gPinball.PinballTable;
   import flash.display.MovieClip;
   import flash.events.*;
   import flash.geom.Point;
   
   public class Trigger extends MovieClip
   {
      
      public var __Active:Boolean = true;
      
      public var __CoreFunc:Boolean;
      
      public var __SndEffect:String = "none";
      
      public var hit:MovieClip;
      
      private var __TrigArray:String;
      
      public var __TriggerFunction:Function;
      
      public var __Location:String;
      
      public var __FuncArgs:Array;
      
      public var __TriggerString:String = "defaultFunction";
      
      public var __EffectTrigger:Boolean;
      
      public function Trigger()
      {
         super();
         hit.width *= scaleX;
         scaleX = 1;
         scaleY = 1;
         visible = false;
         addEventListener("enterFrame",init,false,0,true);
      }
      
      public function setActive(param1:Boolean) : void
      {
         __Active = param1;
      }
      
      public function init(param1:Event) : void
      {
         var _loc2_:PinballTable = null;
         var _loc3_:int = 0;
         var _loc4_:MovieClip = null;
         removeEventListener("enterFrame",init);
         _loc2_ = PinballCore.__Table;
         if(__Location == "useParent")
         {
            __Location = (parent as MovieClip).__Location;
         }
         if(parent.name == "loganSaucer")
         {
         }
         if(__Location == "table")
         {
            _loc3_ = 1;
            while(_loc3_ <= _loc2_.total_sections)
            {
               _loc4_ = _loc2_["sec" + _loc3_];
               if(hitTestObject(_loc4_))
               {
                  __TrigArray = "triggers" + _loc3_;
                  if(_loc2_[__TrigArray] == null)
                  {
                     _loc2_[__TrigArray] = new Array();
                  }
                  _loc2_[__TrigArray].push(this);
               }
               _loc3_++;
            }
         }
         else
         {
            __TrigArray = __Location + "_triggers";
            if(_loc2_[__TrigArray] == null)
            {
               _loc2_[__TrigArray] = new Array();
            }
            _loc2_[__TrigArray].push(this);
         }
         if(__CoreFunc)
         {
            __TriggerFunction = PinballCore.__Root[__TriggerString];
         }
         else
         {
            __TriggerFunction = parent[__TriggerString];
         }
      }
      
      public function check(param1:Point, param2:Point, param3:Ball) : void
      {
         var _loc4_:MovieClip = null;
         var _loc5_:Point = null;
         var _loc6_:Point = null;
         var _loc7_:Number = NaN;
         var _loc8_:Number = NaN;
         if(__Active)
         {
            _loc4_ = PinballCore.__Table;
            _loc5_ = param2.clone();
            _loc6_ = param1.clone();
            _loc5_ = _loc4_.localToGlobal(_loc5_);
            _loc5_ = this.globalToLocal(_loc5_);
            _loc6_ = _loc4_.localToGlobal(_loc6_);
            _loc6_ = this.globalToLocal(_loc6_);
            if(_loc5_.y >= -param3.radius && _loc6_.y < -param3.radius && _loc5_.y > _loc6_.y)
            {
               _loc7_ = -param3.radius / 2;
               _loc8_ = this.hit.width + param3.radius / 2;
               if(_loc6_.x <= _loc8_ && _loc5_.x >= _loc7_ || _loc6_.x >= _loc7_ && _loc5_.x <= _loc8_)
               {
                  if(name == "enter_ramp" && (parent.name == "gmramp" || parent.name == "marketramp" || parent.name == "guildramp"))
                  {
                  }
                  if(__SndEffect != "none")
                  {
                     PinballCore.__Root.playSound(__SndEffect);
                  }
                  if(__EffectTrigger)
                  {
                     __TriggerFunction(__FuncArgs);
                  }
                  else
                  {
                     __TriggerFunction(param3,name);
                  }
               }
            }
         }
      }
      
      public function get active() : Boolean
      {
         return __Active;
      }
      
      public function dTrace(param1:String) : void
      {
         PinballCore.dTrace("[Trigger]",param1);
      }
   }
}

