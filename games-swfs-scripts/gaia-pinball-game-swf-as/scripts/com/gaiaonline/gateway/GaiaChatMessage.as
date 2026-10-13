package com.gaiaonline.gateway
{
   public class GaiaChatMessage implements IGaiaObject
   {
      
      public var global:uint = 0;
      
      public var message:String = "";
      
      public var color:uint = 0;
      
      private var _sender:GaiaIdentity = null;
      
      public var recipients:Array = null;
      
      public function GaiaChatMessage(param1:Object = null, param2:GaiaIdentity = null)
      {
         super();
         if(param1)
         {
            this.fromObject(param1);
         }
         this._sender = param2;
      }
      
      public static function create(param1:Object) : GaiaChatMessage
      {
         return new GaiaChatMessage(param1);
      }
      
      public static function create2(param1:String, param2:uint = 0, param3:uint = 0) : GaiaChatMessage
      {
         return new GaiaChatMessage({
            "message":param1,
            "color":param2,
            "global":param3
         });
      }
      
      public function toObject() : Object
      {
         var _loc1_:Object = null;
         _loc1_ = new Object();
         _loc1_.message = this.message;
         _loc1_.color = this.color;
         if(this.global)
         {
            _loc1_.global = this.global;
         }
         if(this.recipients)
         {
            _loc1_.recipients = this.recipients;
         }
         return _loc1_;
      }
      
      public function fromObject(param1:Object) : void
      {
         this.message = param1.message;
         this.color = param1.color;
         this.global = param1.global ? uint(param1.global) : 0;
         this.recipients = param1.recipients ? param1.recipients : null;
      }
      
      public function get sender() : GaiaIdentity
      {
         return this._sender;
      }
   }
}

