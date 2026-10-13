package com.gaiaonline.gameFramework.shell
{
   import com.gaiaonline.gameFramework.sound.ISoundController;
   import com.gaiaonline.gameFramework.ui.IShellUi;
   import com.gaiaonline.gameFramework.ui.IUserBar;
   import com.gaiaonline.gateway.IGaiaGateway;
   
   public interface IGameShell
   {
      
      function get userBar() : IUserBar;
      
      function get serverGateway() : IGaiaGateway;
      
      function get gameBaseUrl() : String;
      
      function get shellUi() : IShellUi;
      
      function get soundController() : ISoundController;
      
      function get gameParameters() : Object;
   }
}

