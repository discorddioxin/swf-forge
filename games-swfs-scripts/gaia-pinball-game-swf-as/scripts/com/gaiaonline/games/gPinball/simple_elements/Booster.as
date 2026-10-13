package com.gaiaonline.games.gPinball.simple_elements
{
   import com.gaiaonline.games.gPinball.PinballCore;
   import flash.events.Event;
   import flash.geom.Point;
   
   public class Booster extends Obstacle
   {
      
      public var __MySndEffect:String = "none";
      
      public var __OverDir:Boolean = false;
      
      public var __Power:Number = 0;
      
      public var __MyLocation:String = "table";
      
      public function Booster()
      {
         super();
         addEventListener("enterFrame",doInit,false,0,true);
      }
      
      override public function check(param1:Point, param2:Point, param3:Ball) : Object
      {
         var _loc4_:Point = null;
         var _loc5_:Point = null;
         var _loc6_:Point = null;
         var _loc7_:Point = null;
         var _loc8_:Number = NaN;
         var _loc9_:Number = NaN;
         var _loc10_:Point = null;
         if(__Active)
         {
            _loc4_ = param1.clone();
            _loc5_ = param2.clone();
            _loc5_ = PinballCore.__Table.localToGlobal(_loc5_);
            _loc6_ = globalToLocal(_loc5_);
            _loc4_ = PinballCore.__Table.localToGlobal(_loc4_);
            _loc7_ = globalToLocal(_loc4_);
            if(_loc6_.y >= -param3.radius && _loc7_.y < 0 && _loc6_.y > _loc7_.y)
            {
               _loc8_ = -param3.radius / 2;
               _loc9_ = hit.width + param3.radius / 2;
               if(_loc7_.x <= _loc9_ && _loc6_.x >= _loc8_ || _loc7_.x >= _loc8_ && _loc6_.x <= _loc9_)
               {
                  _loc10_ = new Point(0,__Power);
                  if(__OverDir)
                  {
                     _loc10_ = _loc10_.add(_loc7_);
                     _loc10_ = localToGlobal(_loc10_);
                     _loc10_ = _loc10_.subtract(_loc4_);
                  }
                  else
                  {
                     _loc10_ = _loc10_.subtract(_loc7_);
                     _loc10_.normalize(__Power);
                     _loc10_ = localToGlobal(_loc10_);
                     _loc10_ = _loc10_.subtract(_loc4_);
                  }
                  _loc10_.normalize(__Power);
                  param3.v.reset(_loc10_.x,_loc10_.y);
               }
            }
         }
         return null;
      }
      
      public function doInit(param1:Event) : void
      {
         removeEventListener("enterFrame",doInit);
         super.init(0,__Power,__MyLocation,null,0);
      }
      
      override public function dTrace(param1:String) : void
      {
         PinballCore.dTrace("[Booster]",param1);
      }
   }
}

